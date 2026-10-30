// 한글원샷 새 판 서버(2026-10-30, 시트 없이) — Cloudflare Pages Functions + D1(DB) + KV(FILES).
// 지금 판 apps-script/Code.gs와 같은 약속(요청·응답 JSON, 오류 이름)을 지킨다. 화면(index.html)은 API_URL이 '/api'로 바뀔 뿐이다.
//  GET  /api?action=data   → 자료·주제·설정(공개만, join_code 빼고)
//  POST /api {action:'join'|'login'|'upload'|'delete'|'hide'|'fav', code, ...}   (본문 JSON)
//  POST /api 파일 올리기: 본문 = 파일 바이트, 머리글 X-Oneshot = encodeURIComponent(JSON {action:'upload', code, material, file:{name,type}})
//       (base64 JSON을 풀면 CPU 한도 10ms를 넘으므로 바이트를 그대로 KV에 흘려 넣는다)
//  GET  /f/<키>            → 올린 파일. 지운 자료의 파일은 404(KV에는 남겨 두어 되살릴 수 있다)
// 로그인 코드는 HMAC-SHA256(비밀 CODE_PEPPER) 해시만 저장한다. 틀린 코드·가입 코드는 기기별 10분 30번, 전체 300번이면 10분 막는다.

const FILE_MAX_MB = 10;   // index.html의 FILE_MAX_MB·FILE_EXT와 같게
const FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
const FILE_MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
const FAIL_LIMIT = 30, FAIL_ALL = 300, FAIL_WINDOW_MS = 600000;
const FAV_MAX = 500;

const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const no = error => json({ ok: false, error });
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 1000);
const rand = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
function today() {   // yyyy-MM-dd, 파리 날짜(시트와 같게)
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
    if (request.method === 'POST') return await post(request, env);
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
    return new Response(got.value, { headers: {
      'Content-Type': md.type || 'application/octet-stream',
      'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(md.name || key),
      'Cache-Control': 'private, no-cache',   // 지우면 바로 닫히게 늘 서버에 다시 묻는다
      'X-Content-Type-Options': 'nosniff'
    } });
  } catch (e) {
    console.error('file', e && e.stack || e);
    return new Response('Error', { status: 500 });
  }
}

// 읽기: 시트 doGet과 같은 꼴. 올린 파일 주소('/f/…')는 지금 주소를 앞에 붙여 내보낸다(시험 주소 → 옮긴 주소에서도 그대로 맞게)
async function readAll(env, origin) {
  const db = env.DB;
  const [st, tp, mt] = await db.batch([
    db.prepare("SELECT key, value FROM settings WHERE key <> 'join_code' ORDER BY rowid"),
    db.prepare('SELECT topic, fr, grp, ord, icon FROM topics ORDER BY rowid'),
    db.prepare('SELECT id, grp, topic, level, title, type, url, descr, minutes, school, by_name, date FROM materials WHERE deleted IS NULL AND pub = 1 ORDER BY rowid')
  ]);
  const settings = {};
  st.results.forEach(r => { if (r.key) settings[r.key] = String(r.value == null ? '' : r.value); });
  return {
    ok: true, settings,
    topics: tp.results.map(r => ({ topic: r.topic, fr: r.fr, group: r.grp, order: r.ord == null ? '' : r.ord, icon: r.icon })),
    materials: mt.results.map(r => ({ id: r.id, group: r.grp, topic: r.topic, level: r.level, title: r.title, type: r.type,
      url: r.url.startsWith('/') ? origin + r.url : r.url, desc: r.descr, minutes: r.minutes == null ? '' : r.minutes,
      school: r.school, by: r.by_name, date: r.date, pub: '' })),
    updatedAt: new Date().toISOString()
  };
}

async function post(request, env) {
  const meta = request.headers.get('X-Oneshot');
  let b;
  try { b = JSON.parse(meta ? decodeURIComponent(meta) : await request.text()); } catch (e) { return no('bad_json'); }
  if (!b || typeof b !== 'object') return no('bad_json');
  const who = await device(env, request);
  if (await tooMany(env, who)) return no('too_many');
  if (b.action === 'join') return join(env, b, who);
  const tc = await findTeacher(env, b.code);
  if (!tc) { await addFail(env, who); return no('bad_code'); }
  if (b.action === 'login') return json({ ok: true, teacher: { name: tc.name, school: tc.school }, favs: await favList(env, tc.id) });
  if (b.action === 'fav') return fav(env, b, tc);
  if (b.action === 'upload') return upload(env, request, b, tc, !!meta);
  if (b.action === 'delete' || b.action === 'hide') return remove(env, b, tc, b.action);
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
  return env.DB.prepare('SELECT id, name, school FROM teachers WHERE code_hash = ?1 AND active = 1').bind(await codeHash(env, code)).first();
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
    const code = String(10000000 + rand(90000000));
    try {
      await env.DB.prepare('INSERT INTO teachers (name, name_key, school, code_hash, joined) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(name, key, school, await codeHash(env, code), today()).run();
      return json({ ok: true, teacher: { name, school }, code });
    } catch (e) {
      const msg = String(e && e.message);
      if (/name_key/.test(msg)) return no('dup_name');
      if (!/UNIQUE/i.test(msg)) throw e;   // code_hash가 겹치면 새 코드로 다시
    }
  }
  return no('server');
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
async function upload(env, request, b, tc, isFile) {
  const m = b.material || {};
  const topic = str(m.topic, 60), level = str(m.level, 10), title = str(m.title, 60);
  if (!title || !topic || !level) return no('missing');
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

  let id = 'm' + Date.now().toString(36);
  for (let i = 0; i < 4; i++) {
    try {
      await env.DB.prepare('INSERT INTO materials (id, grp, topic, level, title, type, url, file_key, descr, minutes, school, by_name, teacher_id, date, pub) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1)')
        .bind(id, str(m.group, 40), topic, level, title, str(m.type, 20), url, fileKey, str(m.desc, 80), Number(m.minutes) || null,
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
