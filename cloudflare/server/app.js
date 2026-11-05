// 한글원샷 새 판 서버(2026-10-30, 시트 없이) — Cloudflare Pages Functions + D1(DB) + KV(FILES).
// 지금 판 apps-script/Code.gs와 같은 약속(요청·응답 JSON, 오류 이름)을 지킨다. 화면(index.html)은 API_URL이 '/api'로 바뀔 뿐이다.
//  GET  /api?action=data   → 자료·주제·설정(공개만, join_code 빼고)
//  POST /api {action:'join'|'login'|'upload'|'delete'|'hide'|'fav', code, ...}   (본문 JSON)
//  POST /api 파일 올리기: 본문 = 파일 바이트, 머리글 X-Oneshot = encodeURIComponent(JSON {action:'upload', code, material, file:{name,type}})
//       (base64 JSON을 풀면 CPU 한도 10ms를 넘으므로 바이트를 그대로 KV에 흘려 넣는다)
//  GET  /f/<키>            → 올린 파일. 지운 자료의 파일은 404(KV에는 남겨 두어 되살릴 수 있다)
//  GET  /go/<자료 id>      → 자료별 QR이 담는 주소. 지금 링크로 302(2026-10-31)
//  POST /api {action:'admin', code, op, ...} → 관리자 화면(2차, 2026-10-31). 요청마다 코드로 is_admin = 1인지 본다(틀린 코드 401, 관리자 아님 403). 아래 ADMIN 표
// 로그인 코드는 HMAC-SHA256(비밀 CODE_PEPPER) 해시만 저장한다. 틀린 코드·가입 코드는 기기별 10분 30번, 전체 300번이면 10분 막는다.
// Google Play 정책(2026-11-04): POST /api {action:'report', id, reason, text} 자료 신고(로그인 없이) · {action:'leave', code, confirm:true} 계정 삭제 ·
//   올리기는 이용 규칙에 동의한 교사만(teachers.terms_at, 아직이면 agree:true를 함께 보내 동의를 적는다).
// AI 도우미(2026-11-05): POST /api {action:'ai_rec'|'ai_fill'|'ai_ws'|'ws_save', code, ...} — 로그인한 교사만. 내용은 ./ai.js
import { aiAction, wsSave, WS_CSP } from './ai.js';

const FILE_MAX_MB = 10;   // index.html의 FILE_MAX_MB·FILE_EXT와 같게
const FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'html', 'htm'];   // HTML은 2026-11-05 휴먼쌤 "넣어줘"
const FILE_MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8' };
// 교사가 올린 HTML을 여는 방법. 이 주소는 교사 로그인 코드(localStorage)가 있는 화면과 같은 곳이라, sandbox로 다른 곳처럼 격리해 코드를 읽지 못하게 한다.
// allow-same-origin은 절대 넣지 않는다(넣으면 격리가 풀린다). 스크립트·양식·알림창·새 창은 된다. 저장소는 막히므로 화면이 올릴 때 새로 열면 사라지는 임시 저장소를 넣어 준다(index.html HTML_SHIM).
const HTML_CSP = 'sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock';
const FAIL_LIMIT = 30, FAIL_ALL = 300, FAIL_WINDOW_MS = 600000;
const FAV_MAX = 500;
export const LEVEL_KEYS = ['하', '중', '상'];   // config.js LEVELS와 같게
const SETTING_KEYS = { join_code: 40, notice: 300 };   // 관리자 화면에서 고치는 설정과 글자 수 한도
const REPORT_REASONS = ['inappropriate', 'privacy', 'copyright', 'person', 'other'];   // index.html RP_REASONS와 같게
const REPORT_LIMIT = 10, REPORT_ALL = 200;   // 신고 도배 막기: 기기별·전체, FAIL_WINDOW_MS(10분) 안에

export const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export const no = error => json({ ok: false, error });
export const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 1000);
const rand = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
export const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
export function today() {   // yyyy-MM-dd, 파리 날짜(시트와 같게)
  try { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); }
}

let hKey = null, hFor = '';
async function hmac(env, s) {
  if (!env.CODE_PEPPER) throw new Error('CODE_PEPPER 비밀이 없음');
  if (hFor !== env.CODE_PEPPER) {
    hKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.CODE_PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    hFor = env.CODE_PEPPER;
  }
  const sig = await crypto.subtle.sign('HMAC', hKey, new TextEncoder().encode(s));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const codeHash = (env, code) => hmac(env, 'code|' + code);
const device = async (env, req) => (await hmac(env, 'ip|' + (req.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 16);

export async function handleApi(request, env) {
  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const u = new URL(request.url);
      if ((u.searchParams.get('action') || 'data') !== 'data') return no('unknown');
      return json(await readAll(env, u.origin));
    }
    if (request.method === 'POST') return await post(request, env, new URL(request.url).origin);
    return json({ ok: false, error: 'unknown' }, 405);
  } catch (e) {
    console.error('api', e && e.stack || e);
    return no('server');
  }
}

export async function handleFile(request, env, key) {
  const gone = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  try {
    key = String(key || '');
    if (!/^[a-z0-9]{8,40}\.[a-z0-9]{2,5}$/.test(key)) return gone();
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('', { status: 405 });
    if (!(await env.DB.prepare('SELECT 1 AS x FROM materials WHERE file_key = ?1 AND deleted IS NULL').bind(key).first())) return gone();
    const got = await env.FILES.getWithMetadata(key, { type: 'stream' });
    if (!got || !got.value) return gone();
    const md = got.metadata || {};
    const headers = {
      'Content-Type': md.type || 'application/octet-stream',
      'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(md.name || key),
      'Cache-Control': 'private, no-cache',   // 지우면 바로 닫히게 늘 서버에 다시 묻는다
      'X-Content-Type-Options': 'nosniff'
    };
    // HTML은 격리해서 연다. 서버가 만든 활동지(kind 'ws')는 더 좁게, 인쇄 단추 스크립트 하나만
    if (String(md.type || '').startsWith('text/html')) headers['Content-Security-Policy'] = md.kind === 'ws' ? WS_CSP : HTML_CSP;
    return new Response(got.value, { headers });
  } catch (e) {
    console.error('file', e && e.stack || e);
    return new Response('Error', { status: 500 });
  }
}

// 읽기: 시트 doGet과 같은 꼴. 올린 파일 주소('/f/…')는 지금 주소를 앞에 붙여 내보낸다(시험 주소 → 옮긴 주소에서도 그대로 맞게)
// 소주제마다 고정 번호 qid(짧은 QR 주소 #/q/<qid>/<1|2|3>, 2026-10-31). 학교 칸이 '휴먼쌤'인 자료는 올린이 이름을 싣지 않는다(카드에도 안 보임).
const HIDDEN_SETTINGS = ['join_code', 'qid_seq'];
async function readAll(env, origin) {
  const db = env.DB;
  const [st, tp, mt] = await db.batch([
    db.prepare("SELECT key, value FROM settings WHERE key NOT IN ('join_code', 'qid_seq') ORDER BY rowid"),
    db.prepare('SELECT topic, fr, grp, ord, icon, qid FROM topics ORDER BY rowid'),
    db.prepare('SELECT id, grp, topic, level, title, type, url, descr, descr_fr, minutes, school, by_name, date FROM materials WHERE deleted IS NULL AND pub = 1 ORDER BY rowid')
  ]);
  const settings = {};
  st.results.forEach(r => { if (r.key && !HIDDEN_SETTINGS.includes(r.key)) settings[r.key] = String(r.value == null ? '' : r.value); });
  return {
    ok: true, settings,
    topics: tp.results.map(r => ({ topic: r.topic, fr: r.fr, group: r.grp, order: r.ord == null ? '' : r.ord, icon: r.icon, qid: r.qid == null ? '' : r.qid })),
    materials: mt.results.map(r => ({ id: r.id, group: r.grp, topic: r.topic, level: r.level, title: r.title, type: r.type,
      url: r.url.startsWith('/') ? origin + r.url : r.url, desc: r.descr, desc_fr: r.descr_fr || '', minutes: r.minutes == null ? '' : r.minutes,
      school: r.school, by: String(r.school).trim() === '휴먼쌤' ? '' : r.by_name, date: r.date, pub: '' })),
    updatedAt: new Date().toISOString()
  };
}

// 자료 QR 넘기기(/go/<자료 id>, 2026-10-31): 인쇄한 자료 QR은 이 주소를 담고, 서버가 지금 링크로 302 넘긴다(관리자가 링크를 고쳐도 QR은 그대로).
// 숨기거나 지운 자료면 그 소주제·레벨 화면으로, 모르는 id면 첫 화면으로.
export async function handleGo(request, env, id) {
  const u = new URL(request.url), home = u.origin + '/';
  const to = loc => new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'no-store' } });
  try {
    const m = await env.DB.prepare('SELECT m.url, m.pub, m.deleted, m.topic, m.level, t.qid FROM materials m LEFT JOIN topics t ON t.topic = m.topic WHERE m.id = ?1')
      .bind(String(id || '').slice(0, 40)).first();
    if (!m) return to(home);
    if (m.pub === 1 && !m.deleted && /^(https?:\/\/|\/f\/)/i.test(m.url)) return to(m.url.startsWith('/') ? u.origin + m.url : m.url);
    const lv = LEVEL_KEYS.indexOf(m.level) + 1;
    return to(home + (m.qid != null ? `#/q/${m.qid}${lv ? '/' + lv : ''}` : `#/t/${encodeURIComponent(m.topic)}${m.level ? '/' + encodeURIComponent(m.level) : ''}`));
  } catch (e) {
    console.error('go', e && e.stack || e);
    return to(home);
  }
}

// 소주제 고정 번호: 한 번 쓴 번호는 다시 주지 않는다(지운 소주제의 인쇄 QR이 다른 소주제를 열지 않게). 마지막 번호는 설정 qid_seq(공개 안 함)
async function nextQid(db) {
  await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('qid_seq', (SELECT COALESCE(MAX(qid), 0) FROM topics))").run();
  const r = await db.prepare("UPDATE settings SET value = CAST(MAX(CAST(value AS INTEGER), (SELECT COALESCE(MAX(qid), 0) FROM topics)) + 1 AS TEXT) WHERE key = 'qid_seq' RETURNING value").first();
  return Number(r.value);
}
// 번호가 비어 있는 소주제(옛 서버가 만든 것)에 번호를 채운다. 관리자 자료 받기·소주제 만들 때
async function fillQids(db) {
  const rows = (await db.prepare('SELECT topic FROM topics WHERE qid IS NULL ORDER BY rowid').all()).results;
  for (const r of rows) await db.prepare('UPDATE topics SET qid = ?2 WHERE topic = ?1 AND qid IS NULL').bind(r.topic, await nextQid(db)).run();
}
// 내가 올린 자료 번호들(로그인 응답 — '내 자료'를 이름 대신 번호로 가린다)
async function mineList(env, tc) {
  const r = await env.DB.prepare('SELECT id FROM materials WHERE deleted IS NULL AND (teacher_id = ?1 OR (teacher_id IS NULL AND by_name = ?2)) ORDER BY rowid DESC')
    .bind(tc.id, tc.name).all();
  return r.results.map(x => x.id);
}

async function post(request, env, origin) {
  const meta = request.headers.get('X-Oneshot');
  let b;
  try { b = JSON.parse(meta ? decodeURIComponent(meta) : await request.text()); } catch (e) { return no('bad_json'); }
  if (!b || typeof b !== 'object') return no('bad_json');
  const who = await device(env, request);
  if (await tooMany(env, who)) return no('too_many');
  if (b.action === 'join') return join(env, b, who);
  if (b.action === 'report') return report(env, b, who);   // 학습자도 신고할 수 있게 코드 없이
  const isAdmin = b.action === 'admin';
  const tc = await findTeacher(env, b.code);
  if (!tc) { await addFail(env, who); return isAdmin ? json({ ok: false, error: 'bad_code' }, 401) : no('bad_code'); }
  if (b.action === 'login') {
    const r = { ok: true, teacher: { name: tc.name, school: tc.school }, favs: await favList(env, tc.id), mine: await mineList(env, tc), terms: !!tc.terms_at };
    if (tc.is_admin) r.admin = true;   // 화면이 관리자 입구를 보여 줄 뿐, 관리자 동작은 요청마다 다시 확인한다
    if (env.ANTHROPIC_API_KEY) r.ai = true;   // 키를 넣기 전에는 화면에 AI 입구가 보이지 않는다
    return json(r);
  }
  if (isAdmin) return tc.is_admin ? admin(env, b, tc, origin) : json({ ok: false, error: 'not_admin' }, 403);
  if (b.action === 'fav') return fav(env, b, tc);
  if (b.action === 'upload') return upload(env, request, b, tc, !!meta);
  if (b.action === 'ai_rec' || b.action === 'ai_fill' || b.action === 'ai_ws') return aiAction(env, request, b, tc, !!meta);
  if (b.action === 'ws_save') return wsSave(env, b, tc);
  if (b.action === 'delete' || b.action === 'hide') return remove(env, b, tc, b.action);
  if (b.action === 'leave') return leave(env, b, tc);
  return no('unknown');
}

async function tooMany(env, who) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(who = ?1), 0) AS mine FROM fails WHERE at > ?2').bind(who, Date.now() - FAIL_WINDOW_MS).first();
  return r.mine >= FAIL_LIMIT || r.n >= FAIL_ALL;
}
async function addFail(env, who) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fails WHERE at <= ?1').bind(now - FAIL_WINDOW_MS),
    env.DB.prepare('INSERT INTO fails (who, at) VALUES (?1, ?2)').bind(who, now)
  ]);
}

async function findTeacher(env, code) {
  code = str(code, 100); if (!code) return null;
  return env.DB.prepare('SELECT id, name, school, is_admin, terms_at FROM teachers WHERE code_hash = ?1 AND active = 1').bind(await codeHash(env, code)).first();
}
async function favList(env, tid) {
  const r = await env.DB.prepare('SELECT material_id FROM favs WHERE teacher_id = ?1 ORDER BY added DESC LIMIT ?2').bind(tid, FAV_MAX).all();
  return r.results.map(x => x.material_id);
}

// 가입: 가입 코드가 맞으면 로그인 코드 8자리를 만들어 교사로 적는다. 이름은 겹치지 않게(카드에 이름이 보인다)
async function join(env, b, who) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'join_code'").first();
  const open = str(row && row.value);
  if (!open) return no('join_closed');
  const norm = s => String(s || '').replace(/\s+/g, '').toUpperCase();
  if (norm(b.joinCode) !== norm(open)) { await addFail(env, who); return no('bad_join'); }
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 20), school = str(b.school, 60);
  if (!name || !school) return no('missing');
  if (b.agree !== true) return no('need_agree');
  const key = name.replace(/\s+/g, '').toLowerCase();
  if (await env.DB.prepare('SELECT 1 AS x FROM teachers WHERE name_key = ?1').bind(key).first()) return no('dup_name');
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await env.DB.prepare('INSERT INTO teachers (name, name_key, school, code_hash, joined, terms_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)')   // 가입 화면에서 이용 규칙에도 동의한다
        .bind(name, key, school, await codeHash(env, code), today()).run();
      return json({ ok: true, teacher: { name, school }, code, ai: !!env.ANTHROPIC_API_KEY });
    } catch (e) {
      const msg = String(e && e.message);
      if (/name_key/.test(msg)) return no('dup_name');
      if (!/UNIQUE/i.test(msg)) throw e;   // code_hash가 겹치면 새 코드로 다시
    }
  }
  return no('server');
}
const newCode = () => String(10000000 + rand(90000000));   // 로그인 코드 8자리

// 소주제가 표에 없으면 만든다(올리기·자료 고치기·되살리기에서, 2차 '새 소주제 자동 등록'). 그 소주제의 대주제를 돌려준다.
// 새 소주제는 맨 뒤 순서(같은 대주제 안에서도 맨 뒤)로 들어간다.
async function ensureTopic(env, topic, group) {
  const have = await env.DB.prepare('SELECT grp FROM topics WHERE topic = ?1').bind(topic).first();
  if (have) return have.grp;
  const g = str(group, 40) || '기타';
  await env.DB.prepare("INSERT OR IGNORE INTO topics (topic, fr, grp, ord, icon, qid) VALUES (?1, '', ?2, (SELECT COALESCE(MAX(ord), 0) + 10 FROM topics), '', ?3)")
    .bind(topic, g, await nextQid(env.DB)).run();
  return g;
}

// 즐겨찾기 담기·빼기. 다시 담으면 맨 앞으로, 500개를 넘으면 오래된 것부터 뺀다
async function fav(env, b, tc) {
  const fid = String(b.id || '').trim();
  if (!fid || fid.length > 40 || fid.includes(',')) return no('missing');
  const db = env.DB;
  if (b.on) {
    await db.batch([
      db.prepare('INSERT INTO favs (teacher_id, material_id, added) VALUES (?1, ?2, MAX(?3, COALESCE((SELECT MAX(added) FROM favs WHERE teacher_id = ?1), 0) + 1)) ' +
        'ON CONFLICT (teacher_id, material_id) DO UPDATE SET added = excluded.added').bind(tc.id, fid, Date.now()),
      db.prepare('DELETE FROM favs WHERE teacher_id = ?1 AND material_id NOT IN (SELECT material_id FROM favs WHERE teacher_id = ?1 ORDER BY added DESC LIMIT ?2)').bind(tc.id, FAV_MAX)
    ]);
  } else {
    await db.prepare('DELETE FROM favs WHERE teacher_id = ?1 AND material_id = ?2').bind(tc.id, fid).run();
  }
  return json({ ok: true, favs: await favList(env, tc.id) });
}

// 올리기: 링크 하나, 또는 파일(PDF·사진 10MB) → KV에 두고 링크는 '/f/<키>'
// 이용 규칙(Play 사용자 제작 콘텐츠 정책): 가입 때 동의하지 않은 옛 교사는 첫 올리기 때 한 번 동의한다
export async function termsOk(env, b, tc) {
  if (tc.terms_at) return true;
  if (b.agree !== true) return false;
  await env.DB.prepare('UPDATE teachers SET terms_at = ?2 WHERE id = ?1').bind(tc.id, today()).run();
  return true;
}
async function upload(env, request, b, tc, isFile) {
  if (!(await termsOk(env, b, tc))) return no('need_terms');
  const m = b.material || {};
  const topic = str(m.topic, 60), level = str(m.level, 10), title = str(m.title, 60);
  if (!title || !topic || !LEVEL_KEYS.includes(level)) return no('missing');   // 레벨은 하·중·상만(2026-10-31)
  let url = str(m.url, 2000), fileKey = null;
  if (isFile) {
    const f = b.file || {};
    const raw = String(f.name || 'file').replace(/[\\/:*?"<>|]/g, '_');
    const ext = (raw.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    if (!FILE_EXT.includes(ext)) return no('file_type');
    const max = FILE_MAX_MB * 1048576, len = Number(request.headers.get('Content-Length') || 0);
    if (len > max) return no('file_big');
    let body = request.body;
    if (!len || !body) {   // 길이를 모르면 받아 놓고 잰다
      const buf = await request.arrayBuffer();
      if (!buf.byteLength) return no('file_empty');
      if (buf.byteLength > max) return no('file_big');
      body = buf;
    }
    const name = raw.slice(0, raw.length - ext.length - 1).slice(0, 100) + '.' + ext;
    fileKey = rid() + '.' + ext;
    try { await env.FILES.put(fileKey, body, { metadata: { name, type: FILE_MIME[ext], teacher: tc.id, day: today(), topic, level } }); }
    catch (e) { console.error('file_put', e && e.stack || e); return no('file_save'); }
    url = '/f/' + fileKey;
  } else if (!/^https?:\/\//i.test(url)) return no('missing');
  return addMaterial(env, tc, Object.assign({}, m, { topic, level, title }), url, fileKey);
}

// 자료 표에 한 줄 더하기(링크·올린 파일·활동지 공통). 실패하면 보관함에 넣어 둔 파일을 지운다
export async function addMaterial(env, tc, m, url, fileKey) {
  const { topic, level, title } = m;
  let id = 'm' + Date.now().toString(36), grp;
  try { grp = await ensureTopic(env, topic, m.group); }
  catch (e) { if (fileKey) await env.FILES.delete(fileKey).catch(() => {}); throw e; }
  for (let i = 0; i < 4; i++) {
    try {
      await env.DB.prepare('INSERT INTO materials (id, grp, topic, level, title, type, url, file_key, descr, descr_fr, minutes, school, by_name, teacher_id, date, pub) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 1)')
        .bind(id, grp, topic, level, title, str(m.type, 20), url, fileKey, str(m.desc, 80), str(m.desc_fr, 120), Number(m.minutes) || null,
          str(m.school, 60) || tc.school || '', tc.name, tc.id, today()).run();
      return json({ ok: true, id });
    } catch (e) {
      if (!/UNIQUE/i.test(String(e && e.message)) || i === 3) { if (fileKey) await env.FILES.delete(fileKey).catch(() => {}); throw e; }
      id = 'm' + Date.now().toString(36) + 'abcdefghijklmnopqrstuvwxyz'[rand(26)];
    }
  }
}

// 삭제(자기 것만): 지운 날짜를 적어 자료실·즐겨찾기에서 빠지고 그 파일 링크도 닫힌다. 숨기기(옛 화면)는 공개만 끈다
async function remove(env, b, tc, action) {
  const row = await env.DB.prepare('SELECT id, teacher_id, by_name FROM materials WHERE id = ?1 AND deleted IS NULL').bind(String(b.id)).first();
  if (!row) return no('not_found');
  const mine = row.teacher_id != null ? row.teacher_id === tc.id : String(row.by_name).trim() === tc.name;
  if (!mine) return no('not_owner');
  if (action === 'hide') await env.DB.prepare('UPDATE materials SET pub = 0 WHERE id = ?1').bind(row.id).run();
  else await env.DB.prepare('UPDATE materials SET deleted = ?2 WHERE id = ?1').bind(row.id, today()).run();
  return json({ ok: true });
}

// 자료 신고(로그인 없이, 이름 없이). 도배를 막으려고 기기 주소 해시를 10분만 두고, 다음 신고 때 비운다
async function report(env, b, who) {
  const id = str(b.id, 40), reason = str(b.reason, 20), text = str(b.text, 300);
  if (!id || !REPORT_REASONS.includes(reason)) return no('missing');
  if (!(await env.DB.prepare('SELECT 1 AS x FROM materials WHERE id = ?1 AND deleted IS NULL').bind(id).first())) return no('not_found');
  const now = Date.now(), since = now - FAIL_WINDOW_MS;
  const c = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(who = ?1), 0) AS mine FROM reports WHERE at > ?2').bind(who, since).first();
  if (c.mine >= REPORT_LIMIT || c.n >= REPORT_ALL) return no('too_many');
  await env.DB.batch([
    env.DB.prepare("UPDATE reports SET who = '' WHERE at <= ?1 AND who <> ''").bind(since),
    env.DB.prepare('INSERT INTO reports (material_id, reason, text, date, at, who) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(id, reason, text, today(), now, who)
  ]);
  return json({ ok: true });
}

// 계정 지우기: 교사 줄·즐겨찾기·올린 자료(지운 자료 포함)·그 자료의 신고·파일까지 모두. 되돌릴 수 없다(D1 복구 지점에는 30일까지 남는다 — privacy.html)
async function removeTeacher(env, tc) {
  const db = env.DB, mine = '(teacher_id = ?1 OR (teacher_id IS NULL AND by_name = ?2))';
  const mats = (await db.prepare(`SELECT file_key FROM materials WHERE ${mine}`).bind(tc.id, tc.name).all()).results;
  await db.batch([
    db.prepare(`DELETE FROM favs WHERE material_id IN (SELECT id FROM materials WHERE ${mine})`).bind(tc.id, tc.name),
    db.prepare(`DELETE FROM reports WHERE material_id IN (SELECT id FROM materials WHERE ${mine})`).bind(tc.id, tc.name),
    db.prepare(`DELETE FROM materials WHERE ${mine}`).bind(tc.id, tc.name),
    db.prepare('DELETE FROM favs WHERE teacher_id = ?1').bind(tc.id),
    db.prepare('DELETE FROM ai_usage WHERE teacher_id = ?1').bind(tc.id),
    db.prepare('DELETE FROM teachers WHERE id = ?1').bind(tc.id)
  ]);
  // 표에서 지워 파일 링크는 이미 닫혔다. 보관함 삭제가 실패해도 계정 삭제를 되돌리지 않고 기록만 남긴다
  await Promise.all(mats.filter(m => m.file_key).map(m => env.FILES.delete(m.file_key).catch(e => console.error('leave_file', m.file_key, e && e.stack || e))));
  return mats.length;
}
// 교사 스스로 계정 삭제. 관리자 계정은 운영에 필요해 여기서 지우지 않는다
async function leave(env, b, tc) {
  if (tc.is_admin) return no('admin_leave');
  if (b.confirm !== true) return no('need_confirm');
  return json({ ok: true, removed: await removeTeacher(env, tc) });
}

// ---------- 관리자 화면(2차, 2026-10-31) ----------
// 시트에서 휴먼쌤이 손으로 하던 일을 화면에서: 자료(전부 찾기·고치기·숨김·삭제·되살리기) · 분류(대주제·소주제) · 교사(끄기·새 코드) · 설정(가입 코드·공지).
// post()가 코드로 is_admin = 1을 확인한 뒤에만 여기로 온다. op 이름이 ADMIN 표에 없으면 unknown.
async function admin(env, b, me, origin) {
  const op = String(b.op || '');
  return Object.prototype.hasOwnProperty.call(ADMIN, op) ? ADMIN[op](env, b, me, origin) : no('unknown');
}
const ok = () => json({ ok: true });
const changed = r => !!(r && r.meta && r.meta.changes);

// 소주제 순서: 화면(index.html prepare)과 같게 순서 칸 값(없거나 0이면 1000 + 넣은 차례)으로 늘어놓고, 대주제는 처음 나온 차례로 묶는다
async function topicTree(db) {
  const rows = (await db.prepare('SELECT topic, grp, ord FROM topics ORDER BY rowid').all()).results;
  const list = rows.map((r, i) => ({ topic: r.topic, grp: r.grp || '기타', k: Number(r.ord) || (1000 + i) })).sort((a, b) => a.k - b.k);
  const groups = [];
  list.forEach(x => { let g = groups.find(y => y.name === x.grp); if (!g) groups.push(g = { name: x.grp, topics: [] }); g.topics.push(x.topic); });
  return groups;
}
// 바꾼 차례대로 순서 칸을 10, 20, 30 …으로 다시 매긴다(보이는 차례 = 대주제 차례 → 그 안의 소주제 차례)
async function saveOrder(db, groups) {
  const stmts = []; let n = 0;
  groups.forEach(g => g.topics.forEach(tp => stmts.push(db.prepare('UPDATE topics SET ord = ?2 WHERE topic = ?1').bind(tp, (++n) * 10))));
  if (stmts.length) await db.batch(stmts);
}
const swap = (a, i, d) => { const j = i + d; if (i < 0 || j < 0 || j >= a.length) return false; [a[i], a[j]] = [a[j], a[i]]; return true; };

const ADMIN = {
  // 관리자 화면 한 번에 받기: 설정(가입 코드 포함) · 소주제 · 자료 전부(숨김·지운 것 포함) · 교사(올린 자료 수, 코드·해시는 빼고)
  async overview(env, b, me, origin) {
    const db = env.DB;
    await fillQids(db);
    const [st, tp, mt, tc, rp, ai] = await db.batch([
      db.prepare('SELECT key, value FROM settings ORDER BY rowid'),
      db.prepare('SELECT topic, fr, grp, ord, icon, qid FROM topics ORDER BY rowid'),
      db.prepare('SELECT id, grp, topic, level, title, type, url, file_key, descr, descr_fr, school, by_name, teacher_id, date, pub, deleted FROM materials ORDER BY rowid'),
      db.prepare('SELECT t.id, t.name, t.school, t.joined, t.active, t.is_admin, (SELECT COUNT(*) FROM materials m WHERE m.deleted IS NULL AND ' +
        '(m.teacher_id = t.id OR (m.teacher_id IS NULL AND m.by_name = t.name))) AS n FROM teachers t ORDER BY t.id'),
      db.prepare('SELECT r.id, r.material_id, r.reason, r.text, r.date, r.done, m.title, m.topic, m.level, m.url, m.by_name, m.pub, m.deleted ' +
        'FROM reports r LEFT JOIN materials m ON m.id = r.material_id ORDER BY r.id DESC LIMIT 200'),
      db.prepare('SELECT COALESCE(SUM(n), 0) AS n, COALESCE(SUM(tokens_in), 0) AS i, COALESCE(SUM(tokens_out), 0) AS o FROM ai_usage WHERE day >= ?1').bind(today().slice(0, 8) + '01')   // 이번 달
    ]);
    const settings = {};
    st.results.forEach(r => { if (r.key) settings[r.key] = String(r.value == null ? '' : r.value); });
    return json({
      ok: true, me: me.id, settings,
      ai: { on: !!env.ANTHROPIC_API_KEY, n: ai.results[0].n, in: ai.results[0].i, out: ai.results[0].o },
      topics: tp.results.map(r => ({ topic: r.topic, fr: r.fr, group: r.grp, order: r.ord == null ? '' : r.ord, icon: r.icon, qid: r.qid == null ? '' : r.qid })),
      materials: mt.results.map(r => ({ id: r.id, group: r.grp, topic: r.topic, level: r.level, title: r.title, type: r.type,
        url: r.url.startsWith('/') ? origin + r.url : r.url, file: !!r.file_key, desc: r.descr, desc_fr: r.descr_fr || '', school: r.school, by: r.by_name,
        teacherId: r.teacher_id, date: r.date, pub: r.pub === 1, deleted: r.deleted || '' })),
      teachers: tc.results.map(r => ({ id: r.id, name: r.name, school: r.school, joined: r.joined, active: r.active === 1, admin: r.is_admin === 1, n: r.n })),
      reports: rp.results.map(r => ({ id: r.id, materialId: r.material_id, reason: r.reason, text: r.text, date: r.date, done: r.done || '', title: r.title || '', topic: r.topic || '', level: r.level || '',
        url: r.url ? (r.url.startsWith('/') ? origin + r.url : r.url) : '', by: r.by_name || '', pub: r.pub === 1 && !r.deleted }))
    });
  },
  // 신고 처리 끝(줄은 남긴다)
  async report_done(env, b) {
    return changed(await env.DB.prepare('UPDATE reports SET done = ?2 WHERE id = ?1 AND done IS NULL').bind(Number(b.id), today()).run()) ? ok() : no('not_found');
  },
  // 교사 계정 지우기(코드를 잊은 교사의 삭제 요청을 메일로 받았을 때). 나 자신과 다른 관리자는 지우지 않는다
  async teacher_del(env, b, me) {
    const id = Number(b.id);
    if (!Number.isInteger(id)) return no('missing');
    if (id === me.id) return no('self');
    const row = await env.DB.prepare('SELECT id, name, is_admin FROM teachers WHERE id = ?1').bind(id).first();
    if (!row) return no('not_found');
    if (row.is_admin) return no('admin_leave');
    return json({ ok: true, removed: await removeTeacher(env, row) });
  },

  // 자료 고치기: 소주제·레벨·제목·유형·링크·설명. 올린 파일 자료는 링크를 바꾸지 않는다. 새 소주제면 표에 만든다
  async mat_save(env, b) {
    const db = env.DB, m = b.material || {};
    const row = await db.prepare('SELECT id, url, file_key, descr_fr FROM materials WHERE id = ?1').bind(str(b.id, 40)).first();
    if (!row) return no('not_found');
    const topic = str(m.topic, 60), level = str(m.level, 10), title = str(m.title, 60);
    if (!topic || !title || !LEVEL_KEYS.includes(level)) return no('missing');
    let url = row.url;
    if (!row.file_key) { url = str(m.url, 2000); if (!/^https?:\/\//i.test(url)) return no('bad_url'); }
    const grp = await ensureTopic(env, topic, m.group);
    await db.prepare('UPDATE materials SET grp = ?2, topic = ?3, level = ?4, title = ?5, type = ?6, url = ?7, descr = ?8, descr_fr = ?9 WHERE id = ?1')
      .bind(row.id, grp, topic, level, title, str(m.type, 20), url, str(m.desc, 80), m.desc_fr === undefined ? (row.descr_fr || '') : str(m.desc_fr, 120)).run();
    return ok();
  },
  // 숨김/보이기(공개 칸). 지운 자료도 칸은 바뀌지만 되살리기 전에는 보이지 않는다
  async mat_pub(env, b) {
    return changed(await env.DB.prepare('UPDATE materials SET pub = ?2 WHERE id = ?1').bind(str(b.id, 40), b.on ? 1 : 0).run()) ? ok() : no('not_found');
  },
  async mat_del(env, b) {
    return changed(await env.DB.prepare('UPDATE materials SET deleted = ?2 WHERE id = ?1 AND deleted IS NULL').bind(str(b.id, 40), today()).run()) ? ok() : no('not_found');
  },
  // 되살리기: 지운 날짜를 비운다(올린 파일 링크도 다시 열린다). 그사이 소주제가 없어졌으면 다시 만든다
  async mat_restore(env, b) {
    const db = env.DB, row = await db.prepare('SELECT id, topic, grp FROM materials WHERE id = ?1 AND deleted IS NOT NULL').bind(str(b.id, 40)).first();
    if (!row) return no('not_found');
    await ensureTopic(env, row.topic, row.grp);
    await db.prepare('UPDATE materials SET deleted = NULL WHERE id = ?1').bind(row.id).run();
    return ok();
  },

  // 소주제 고치기(from = 지금 이름) 또는 새로 만들기(from 없음): 이름·프랑스어·대주제·아이콘. 이름을 바꾸면 그 소주제 자료도 따라간다
  async topic_save(env, b) {
    const db = env.DB, from = str(b.from, 60), name = str(b.topic, 60), group = str(b.group, 40) || '기타', fr = str(b.fr, 60), icon = str(b.icon, 16);
    if (!name) return no('missing');
    const has = n => db.prepare('SELECT 1 AS x FROM topics WHERE topic = ?1').bind(n).first();
    if (from) {
      if (!(await has(from))) return no('not_found');
      if (name !== from && await has(name)) return no('dup_topic');
      await db.batch([
        db.prepare('UPDATE topics SET topic = ?2, fr = ?3, grp = ?4, icon = ?5 WHERE topic = ?1').bind(from, name, fr, group, icon),
        db.prepare('UPDATE materials SET topic = ?2, grp = ?3 WHERE topic = ?1').bind(from, name, group)
      ]);
    } else {
      if (await has(name)) return no('dup_topic');
      await db.prepare('INSERT INTO topics (topic, fr, grp, ord, icon, qid) VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(ord), 0) + 10 FROM topics), ?4, ?5)')
        .bind(name, fr, group, icon, await nextQid(db)).run();
    }
    return ok();
  },
  // 소주제 지우기: 남은 자료(숨김 포함, 지운 자료 빼고)가 없을 때만
  async topic_del(env, b) {
    const db = env.DB, name = str(b.topic, 60);
    const used = await db.prepare('SELECT COUNT(*) AS n FROM materials WHERE topic = ?1 AND deleted IS NULL').bind(name).first();
    if (used.n) return no('in_use');
    return changed(await db.prepare('DELETE FROM topics WHERE topic = ?1').bind(name).run()) ? ok() : no('not_found');
  },
  // 소주제 한 칸 위(dir -1)·아래(dir 1), 같은 대주제 안에서
  async topic_move(env, b) {
    const groups = await topicTree(env.DB), name = str(b.topic, 60);
    const g = groups.find(x => x.topics.includes(name));
    if (!g) return no('not_found');
    if (swap(g.topics, g.topics.indexOf(name), b.dir < 0 ? -1 : 1)) await saveOrder(env.DB, groups);
    return ok();
  },
  // 대주제 이름 바꾸기(그 대주제의 소주제·자료 모두) + 프랑스어 이름(설정 group_fr, JSON {대주제: 프랑스어}).
  // 이미 있는 대주제 이름을 주면 합쳐진다. fr을 주지 않으면 프랑스어 이름은 새 이름으로 옮겨 간다
  async group_rename(env, b) {
    const db = env.DB, from = str(b.from, 40), to = str(b.to, 40);
    if (!from || !to) return no('missing');
    if (!(await db.prepare('SELECT 1 AS x FROM topics WHERE grp = ?1').bind(from).first())) return no('not_found');
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'group_fr'").first();
    let map = {};
    try { map = JSON.parse(row && row.value || '{}') || {}; } catch (e) { map = {}; }
    const fr = b.fr === undefined ? (map[from] || '') : str(b.fr, 40);
    delete map[from];
    if (fr) map[to] = fr; else delete map[to];
    const stmts = [db.prepare("INSERT INTO settings (key, value) VALUES ('group_fr', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(map))];
    if (to !== from) stmts.push(db.prepare('UPDATE topics SET grp = ?2 WHERE grp = ?1').bind(from, to), db.prepare('UPDATE materials SET grp = ?2 WHERE grp = ?1').bind(from, to));
    await db.batch(stmts);
    return ok();
  },
  // 대주제 한 칸 위·아래(첫 화면에 묶음이 보이는 차례)
  async group_move(env, b) {
    const groups = await topicTree(env.DB), i = groups.findIndex(g => g.name === str(b.group, 40));
    if (i < 0) return no('not_found');
    if (swap(groups, i, b.dir < 0 ? -1 : 1)) await saveOrder(env.DB, groups);
    return ok();
  },

  // 교사 끄기·켜기. 끈 교사는 로그인·올리기가 안 되고(코드가 틀린 것과 같음) 올린 자료는 그대로 보인다. 나 자신은 끌 수 없다
  async teacher_active(env, b, me) {
    const id = Number(b.id);
    if (!Number.isInteger(id)) return no('missing');
    if (id === me.id && !b.on) return no('self');
    return changed(await env.DB.prepare('UPDATE teachers SET active = ?2 WHERE id = ?1').bind(id, b.on ? 1 : 0).run()) ? ok() : no('not_found');
  },
  // 새 로그인 코드: 코드를 잊은 교사에게. 옛 코드는 해시라 볼 수 없고 바로 막힌다. 새 코드는 이 응답에 한 번만 나간다
  async teacher_code(env, b) {
    const db = env.DB, row = await db.prepare('SELECT id, name FROM teachers WHERE id = ?1').bind(Number(b.id)).first();
    if (!row) return no('not_found');
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      try {
        await db.prepare('UPDATE teachers SET code_hash = ?2 WHERE id = ?1').bind(row.id, await codeHash(env, code)).run();
        return json({ ok: true, name: row.name, code });
      } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
    }
    return no('server');
  },

  // 설정: 가입 코드(비우면 가입 닫힘)·공지(첫 화면 위). 준 것만 바꾼다
  async settings_save(env, b) {
    const db = env.DB, s = b.settings || {}, stmts = [];
    Object.keys(SETTING_KEYS).forEach(k => {
      if (Object.prototype.hasOwnProperty.call(s, k)) stmts.push(db.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value').bind(k, str(s[k], SETTING_KEYS[k])));
    });
    if (!stmts.length) return no('missing');
    await db.batch(stmts);
    return ok();
  }
};
