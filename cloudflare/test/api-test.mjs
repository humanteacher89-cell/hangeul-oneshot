// 한글원샷 새 판 서버 시험(2026-10-30). 지금 판 Code.gs 시험(가짜 구글 서비스 13가지·대량 8가지)의 기대값을 실제 서버에 대고 본다.
//   node cloudflare/test/api-test.mjs <주소> <가입 코드> [--flood]
//   예: node cloudflare/test/api-test.mjs http://127.0.0.1:8788 TEST --flood   (내 컴퓨터 미리 보기)
// 시험 교사 둘('시험…' 이름)과 시험 자료를 만들고, 자료는 끝에 지운다. 교사 줄은 남으니 공개 D1에서는 시험 뒤 데이터를 다시 옮긴다.
// --flood: 틀린 코드 31번 → too_many(이 기기는 10분 동안 막히므로 맨 끝에, 내 컴퓨터에서만)
// 관리자 동작(2026-10-31 2차)은 환경 변수 ADMIN_CODE(관리자 교사 코드, test/admin-seed.mjs로 만든 시험관리자)가 있을 때만 본다.
// 시험 자료·소주제·대주제('시험…' 이름)는 끝에 치우고, 가입 코드·공지는 원래 값으로 되돌린다. 교사 줄은 남는다.
const [base, joinCode] = process.argv.slice(2);
const flood = process.argv.includes('--flood');
if (!base || !joinCode) { console.error('주소와 가입 코드를 주세요'); process.exit(2); }
const API = base.replace(/\/$/, '') + '/api';
let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else fail++; console.log((cond ? '  통과 ' : '  실패 ') + what); };
const post = async (body, init) => (await fetch(API, Object.assign({ method: 'POST', body: JSON.stringify(body) }, init))).json();
const postFile = async (meta, bytes, type) => (await fetch(API, { method: 'POST', headers: { 'Content-Type': type, 'X-Oneshot': encodeURIComponent(JSON.stringify(meta)) }, body: bytes })).json();
const data = async () => (await fetch(API + '?action=data&t=' + Date.now())).json();
const tag = Date.now().toString(36).slice(-5);
const pdf = new TextEncoder().encode('%PDF-1.4\n% hangeul oneshot test ' + tag + '\n%%EOF\n');

console.log('읽기');
let d = await data();
ok(d.ok === true && Array.isArray(d.materials) && Array.isArray(d.topics), '자료·주제가 온다');
ok(!('join_code' in d.settings), '공개 자료에 가입 코드 없음');
ok(d.materials.every(m => /^https?:\/\//.test(m.url)), '자료 링크는 모두 http(s)');
ok((await (await fetch(API + '?action=nope')).json()).error === 'unknown', '모르는 읽기 → unknown');

console.log('가입·로그인');
ok((await fetch(API, { method: 'POST', body: '{nope' }).then(r => r.json())).error === 'bad_json', '깨진 JSON → bad_json');
ok((await post({ action: 'login', code: '00000001' })).error === 'bad_code', '틀린 코드 → bad_code');
ok((await post({ action: 'join', joinCode: 'WRONG', name: '시험' + tag, school: '파리 한글학교', agree: true })).error === 'bad_join', '틀린 가입 코드 → bad_join');
ok((await post({ action: 'join', joinCode, name: ' ', school: '파리 한글학교', agree: true })).error === 'missing', '빈 이름 → missing');
ok((await post({ action: 'join', joinCode, name: '시험' + tag, school: '파리 한글학교' })).error === 'need_agree', '동의 없음 → need_agree');
const j1 = await post({ action: 'join', joinCode: ' ' + joinCode.toLowerCase() + ' ', name: '시험' + tag, school: '파리 한글학교', agree: true });
ok(j1.ok && /^\d{8}$/.test(j1.code) && j1.teacher.name === '시험' + tag, '가입 성공(가입 코드 띄어쓰기·대소문자 무시) → 8자리 코드');
ok((await post({ action: 'join', joinCode, name: '시 험' + tag.toUpperCase(), school: '릴 한글학교', agree: true })).error === 'dup_name', '같은 이름(띄어쓰기·대소문자만 다름) → dup_name');
const j2 = await post({ action: 'join', joinCode, name: '시험둘' + tag, school: '릴 한글학교', agree: true });
ok(j2.ok, '두 번째 교사 가입');
const c1 = j1.code, c2 = j2.code;
const l1 = await post({ action: 'login', code: ' ' + c1 + ' ' });
ok(l1.ok && l1.teacher.school === '파리 한글학교' && Array.isArray(l1.favs) && l1.favs.length === 0, '새 코드로 로그인(앞뒤 띄어쓰기 무시), 즐겨찾기 빈 목록');

console.log('올리기');
const G = '시험대' + tag, T0 = '시험링크' + tag;   // 시험 대주제·소주제(올리면 새 소주제로 자동 등록된다)
const mat = { group: G, topic: T0, level: '하', title: '시험 링크 ' + tag, type: '앱', url: 'https://example.org/' + tag, desc: '한 줄', minutes: 0, school: '보르도 한글학교' };
ok((await post({ action: 'upload', code: c1, material: Object.assign({}, mat, { url: 'ftp://x' }) })).error === 'missing', 'https 아닌 링크 → missing');
ok((await post({ action: 'upload', code: c1, material: Object.assign({}, mat, { title: '' }) })).error === 'missing', '제목 없음 → missing');
ok((await post({ action: 'upload', code: 'nope', material: mat })).error === 'bad_code', '틀린 코드로 올리기 → bad_code');
const u1 = await post({ action: 'upload', code: c1, material: mat });
ok(u1.ok && /^m[0-9a-z]+$/.test(u1.id), '링크 올리기 → id');
d = await data();
const m1 = d.materials.find(m => m.id === u1.id);
ok(m1 && m1.by === '시험' + tag && m1.school === '보르도 한글학교' && m1.level === '하' && m1.date.length === 10, '읽기에 올린이·학교·레벨·날짜가 맞게 나옴');
ok(d.topics.some(x => x.topic === T0 && x.group === G) && m1.group === G, '표에 없는 소주제로 올리면 소주제가 생김(대주제 그대로)');

console.log('파일');
const fmeta = name => ({ action: 'upload', code: c1, material: Object.assign({}, mat, { url: '', title: '시험 파일 ' + tag, type: '활동지' }), file: { name, type: 'application/pdf' } });
ok((await postFile(fmeta('문서.docx'), pdf, 'application/octet-stream')).error === 'file_type', 'docx → file_type');
ok((await postFile(Object.assign(fmeta('a.pdf'), { code: 'nope' }), pdf, 'application/pdf')).error === 'bad_code', '틀린 코드로 파일 → bad_code');
ok((await postFile(fmeta('큰.pdf'), new Uint8Array(10 * 1048576 + 1), 'application/pdf')).error === 'file_big', '10MB 넘는 파일 → file_big');
const u2 = await postFile(fmeta('시험 활동지.pdf'), pdf, 'application/pdf');
ok(u2.ok, 'PDF 올리기');
d = await data();
const m2 = d.materials.find(m => m.id === u2.id);
ok(m2 && m2.url.startsWith(base.replace(/\/$/, '') + '/f/') && m2.url.endsWith('.pdf'), '파일 링크가 이 주소의 /f/…pdf');
const fr = await fetch(m2.url);
const fb = new Uint8Array(await fr.arrayBuffer());
ok(fr.status === 200 && fr.headers.get('content-type') === 'application/pdf' && fb.length === pdf.length && fb.every((x, i) => x === pdf[i]), '파일을 받으면 같은 바이트·PDF 형식');
ok(/filename\*=UTF-8''/.test(fr.headers.get('content-disposition') || ''), '파일 이름(한글)이 머리글에');

console.log('즐겨찾기');
let f = await post({ action: 'fav', code: c1, id: u1.id, on: true });
ok(f.ok && f.favs.join() === u1.id, '담기');
f = await post({ action: 'fav', code: c1, id: u2.id, on: true });
ok(f.favs.join() === [u2.id, u1.id].join(), '두 번째 담기 → 최근이 앞');
f = await post({ action: 'fav', code: c1, id: u1.id, on: true });
ok(f.favs.join() === [u1.id, u2.id].join(), '다시 담으면 맨 앞으로');
f = await post({ action: 'fav', code: c1, id: u1.id, on: false });
ok(f.favs.join() === u2.id, '빼기');
ok((await post({ action: 'fav', code: c1, id: 'a,b', on: true })).error === 'missing', '쉼표 든 id → missing');
ok((await post({ action: 'login', code: c1 })).favs.join() === u2.id, '로그인하면 즐겨찾기가 옴(다른 기기)');
ok((await post({ action: 'login', code: c2 })).favs.length === 0, '다른 교사 즐겨찾기는 따로');

console.log('삭제·숨기기');
ok((await post({ action: 'delete', code: c2, id: u1.id })).error === 'not_owner', '남의 자료 삭제 → not_owner');
ok((await post({ action: 'delete', code: c1, id: u2.id })).ok, '내 파일 자료 삭제');
d = await data();
ok(!d.materials.some(m => m.id === u2.id), '읽기에서 빠짐');
ok((await fetch(m2.url)).status === 404, '지운 자료의 파일 링크는 404');
ok((await post({ action: 'delete', code: c1, id: u2.id })).error === 'not_found', '다시 삭제 → not_found');
ok((await post({ action: 'hide', code: c1, id: u1.id })).ok, '옛 숨기기');
d = await data();
ok(!d.materials.some(m => m.id === u1.id), '숨긴 자료도 읽기에서 빠짐');
ok((await post({ action: 'delete', code: c1, id: u1.id })).ok, '숨긴 자료 삭제(시험 자료 치우기)');
ok((await post({ action: 'nope', code: c1 })).error === 'unknown', '모르는 동작 → unknown');

const A = String(process.env.ADMIN_CODE || '').trim();
if (A) {
  console.log('관리자 — 들어가기');
  const adm = async (op, body, code) => { const r = await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({ action: 'admin', op, code: code || A }, body)) }); return Object.assign(await r.json(), { status: r.status }); };
  const la = await post({ action: 'login', code: A });
  ok(la.ok && la.admin === true, '관리자 로그인 → admin 표시');
  ok(!('admin' in (await post({ action: 'login', code: c1 }))), '보통 교사 로그인에는 admin 없음');
  let r = await adm('overview', {}, c1);
  ok(r.status === 403 && r.error === 'not_admin', '보통 교사가 관리자 동작 → 403 not_admin');
  r = await adm('overview', {}, '00000002');
  ok(r.status === 401 && r.error === 'bad_code', '틀린 코드로 관리자 동작 → 401 bad_code');
  ok((await adm('nope')).error === 'unknown', '모르는 관리자 동작 → unknown');
  let o = await adm('overview');
  ok(o.ok && Array.isArray(o.materials) && Array.isArray(o.topics) && Array.isArray(o.teachers) && typeof o.settings.join_code === 'string', '관리자 자료: 자료·소주제·교사·가입 코드');
  ok(o.teachers.every(x => !('code' in x) && !('code_hash' in x)) && o.teachers.some(x => x.id === o.me && x.admin), '교사 목록에 코드·해시 없음, 나는 관리자');
  ok(o.materials.some(m => m.id === u1.id && m.deleted) && o.materials.some(m => m.id === u2.id && m.deleted && m.file), '지운 자료(파일 포함)도 보임');
  const t1 = o.teachers.find(x => x.name === '시험' + tag);
  ok(t1 && t1.n === 0 && t1.active && !t1.admin && t1.joined.length === 10, '교사: 올린 자료 수(지운 것 빼고)·켜짐·가입일');

  console.log('관리자 — 자료');
  const T1 = '시험소' + tag, T2 = '시험자동' + tag;
  ok((await adm('topic_save', { topic: T1, fr: 'Test', group: G, icon: '🧪' })).ok, '새 소주제 만들기');
  ok((await adm('topic_save', { topic: T1, group: G })).error === 'dup_topic', '같은 이름 소주제 → dup_topic');
  const u3 = await post({ action: 'upload', code: c1, material: Object.assign({}, mat, { topic: T2, title: '시험 자동 ' + tag, url: 'https://example.org/a/' + tag }) });
  d = await data();
  ok(u3.ok && d.topics.some(x => x.topic === T2 && x.group === G), '다른 새 소주제로 올리기 → 소주제 자동 등록');
  const fine = { topic: T1, level: '중', title: '고친 제목 ' + tag, type: '퀴즈', url: 'https://example.org/b/' + tag, desc: '고친 설명' };
  ok((await adm('mat_save', { id: u3.id, material: fine })).ok, '자료 고치기');
  d = await data();
  const m3 = d.materials.find(m => m.id === u3.id);
  ok(m3 && m3.topic === T1 && m3.level === '중' && m3.title === fine.title && m3.type === '퀴즈' && m3.url === fine.url && m3.desc === '고친 설명' && m3.group === G, '고친 것이 자료실에 그대로(대주제는 소주제를 따름)');
  ok((await adm('mat_save', { id: u3.id, material: Object.assign({}, fine, { url: 'ftp://x' }) })).error === 'bad_url', 'https 아닌 링크로 고치기 → bad_url');
  ok((await adm('mat_save', { id: u3.id, material: Object.assign({}, fine, { level: '최상' }) })).error === 'missing', '하·중·상 아닌 레벨 → missing');
  ok((await adm('mat_save', { id: 'nope' + tag, material: fine })).error === 'not_found', '없는 자료 고치기 → not_found');
  const u4 = await postFile(Object.assign(fmeta('관리 시험.pdf'), { material: Object.assign({}, mat, { topic: T1, title: '시험 파일2 ' + tag, url: '', type: '활동지' }) }), pdf, 'application/pdf');
  ok((await adm('mat_save', { id: u4.id, material: Object.assign({}, fine, { level: '상', title: '파일 고침 ' + tag, url: 'https://example.org/c/' + tag }) })).ok, '파일 자료 고치기');
  d = await data();
  const m4 = d.materials.find(m => m.id === u4.id);
  ok(m4 && m4.level === '상' && m4.title === '파일 고침 ' + tag && m4.url.includes('/f/'), '올린 파일 자료는 고쳐도 링크(파일)는 그대로');
  ok((await adm('mat_pub', { id: u3.id, on: false })).ok && !(await data()).materials.some(m => m.id === u3.id), '숨기기 → 자료실에서 빠짐');
  o = await adm('overview');
  ok(o.materials.find(m => m.id === u3.id).pub === false, '관리자 자료에는 숨김으로 남음');
  ok((await adm('mat_pub', { id: u3.id, on: true })).ok && (await data()).materials.some(m => m.id === u3.id), '보이기 → 자료실에 다시');
  ok((await adm('mat_del', { id: u4.id })).ok, '남이 올린 자료도 관리자는 삭제');
  ok((await fetch(m4.url)).status === 404, '지운 파일 링크 404');
  ok((await adm('mat_del', { id: u4.id })).error === 'not_found', '다시 삭제 → not_found');
  ok((await adm('mat_restore', { id: u4.id })).ok && (await data()).materials.some(m => m.id === u4.id), '되살리기 → 자료실에 다시');
  ok((await fetch(m4.url)).status === 200, '되살린 파일 링크가 다시 열림');
  ok((await adm('mat_restore', { id: u4.id })).error === 'not_found', '지우지 않은 자료 되살리기 → not_found');

  console.log('관리자 — 분류');
  const T1b = T1 + '고침';
  ok((await adm('topic_save', { from: T1, topic: T1b, fr: 'Test2', group: G, icon: '' })).ok, '소주제 이름 바꾸기');
  d = await data();
  ok(d.topics.some(x => x.topic === T1b && x.fr === 'Test2') && !d.topics.some(x => x.topic === T1), '소주제 표에 새 이름');
  ok(d.materials.filter(m => m.id === u3.id || m.id === u4.id).length === 2 && d.materials.filter(m => m.id === u3.id || m.id === u4.id).every(m => m.topic === T1b), '그 소주제 자료도 새 이름으로');
  ok((await adm('topic_save', { from: T1b, topic: T2, group: G })).error === 'dup_topic', '있는 이름으로 바꾸기 → dup_topic');
  ok((await adm('topic_save', { from: 'nope' + tag, topic: 'x' + tag })).error === 'not_found', '없는 소주제 고치기 → not_found');
  ok((await adm('topic_del', { topic: T1b })).error === 'in_use', '자료가 있는 소주제 지우기 → in_use');
  const order = async () => { const x = await adm('overview'); return x.topics.map((tp, i) => ({ n: tp.topic, g: tp.group || '기타', k: Number(tp.order) || 1000 + i })).sort((a, b) => a.k - b.k); };
  let ord = await order();
  const inG = () => ord.filter(x => x.g === G).map(x => x.n), gs = () => [...new Set(ord.map(x => x.g))];
  const before = inG(), i2 = before.indexOf(T2);
  ok(i2 > 0 && (await adm('topic_move', { topic: T2, dir: -1 })).ok, '소주제 한 칸 위로');
  ord = await order();
  ok(inG().indexOf(T2) === i2 - 1, '같은 대주제 안에서 한 칸 올라감');
  ok((await adm('topic_move', { topic: T2, dir: 1 })).ok && (ord = await order()) && inG().join() === before.join(), '다시 아래로 → 제자리');
  const g0 = gs(), gi = g0.indexOf(G);
  ok(gi > 0 && (await adm('group_move', { group: G, dir: -1 })).ok, '대주제 한 칸 위로');
  ord = await order();
  ok(gs().indexOf(G) === gi - 1, '대주제 차례가 한 칸 앞으로');
  ok((await adm('group_move', { group: G, dir: 1 })).ok && (ord = await order()) && gs().join() === g0.join(), '다시 아래로 → 대주제 차례 제자리');
  ok((await adm('topic_move', { topic: 'nope' + tag, dir: 1 })).error === 'not_found', '없는 소주제 옮기기 → not_found');
  const G2 = G + '고침';
  ok((await adm('group_rename', { from: G, to: G2 })).ok, '대주제 이름 바꾸기');
  d = await data();
  ok(d.topics.filter(x => [T0, T1b, T2].includes(x.topic)).every(x => x.group === G2) && d.materials.find(m => m.id === u3.id).group === G2, '그 소주제·자료의 대주제가 새 이름');
  ok((await adm('group_rename', { from: 'nope' + tag, to: 'x' })).error === 'not_found', '없는 대주제 → not_found');

  console.log('관리자 — 교사');
  o = await adm('overview');
  const t2 = o.teachers.find(x => x.name === '시험둘' + tag);
  ok((await adm('teacher_active', { id: t2.id, on: false })).ok, '교사 끄기');
  ok((await post({ action: 'login', code: c2 })).error === 'bad_code', '끈 교사는 로그인 안 됨');
  ok((await adm('teacher_active', { id: o.me, on: false })).error === 'self', '나 자신 끄기 → self');
  ok((await adm('teacher_active', { id: t2.id, on: true })).ok && (await post({ action: 'login', code: c2 })).ok, '다시 켜면 로그인됨');
  const nc = await adm('teacher_code', { id: t2.id });
  ok(nc.ok && /^\d{8}$/.test(nc.code) && nc.code !== c2 && nc.name === '시험둘' + tag, '새 로그인 코드 8자리');
  ok((await post({ action: 'login', code: c2 })).error === 'bad_code' && (await post({ action: 'login', code: nc.code })).ok, '옛 코드는 막히고 새 코드로 로그인');
  ok((await adm('teacher_code', { id: 99999999 })).error === 'not_found', '없는 교사 새 코드 → not_found');

  console.log('관리자 — 설정');
  const jc0 = o.settings.join_code, nt0 = o.settings.notice || '', jcNew = 'T' + tag.toUpperCase();
  ok((await adm('settings_save', { settings: { join_code: jcNew } })).ok, '가입 코드 바꾸기');
  ok((await post({ action: 'join', joinCode, name: '시험셋' + tag, school: '파리 한글학교', agree: true })).error === 'bad_join', '옛 가입 코드 → bad_join');
  ok((await post({ action: 'join', joinCode: jcNew, name: '시험셋' + tag, school: '파리 한글학교', agree: true })).ok, '새 가입 코드로 가입');
  ok((await adm('settings_save', { settings: { join_code: '' } })).ok && (await post({ action: 'join', joinCode: jcNew, name: '시험넷' + tag, school: '파리 한글학교', agree: true })).error === 'join_closed', '가입 닫기 → join_closed');
  ok((await adm('settings_save', { settings: { notice: '시험 공지 ' + tag } })).ok && (await data()).settings.notice === '시험 공지 ' + tag, '공지가 자료실에');
  ok((await adm('settings_save', { settings: { title: 'x' } })).error === 'missing', '고칠 수 없는 설정 → missing');
  ok((await adm('settings_save', { settings: { join_code: jc0, notice: nt0 } })).ok, '가입 코드·공지 되돌리기');
  o = await adm('overview');
  d = await data();
  ok(o.settings.join_code === jc0 && (o.settings.notice || '') === nt0 && !('join_code' in d.settings), '되돌린 값 그대로 · 공개 자료에 가입 코드 없음');

  console.log('관리자 — 치우기');
  for (const id of [u3.id, u4.id]) await adm('mat_del', { id });
  ok((await adm('topic_del', { topic: T0 })).ok && (await adm('topic_del', { topic: T1b })).ok && (await adm('topic_del', { topic: T2 })).ok, '시험 소주제 지우기(지운 자료만 남은 소주제)');
  ok((await adm('topic_del', { topic: T2 })).error === 'not_found', '없는 소주제 지우기 → not_found');
  d = await data();
  ok(!d.topics.some(x => String(x.group).startsWith(G)) && !d.materials.some(m => String(m.title).includes(tag)), '시험 소주제·자료가 자료실에 남지 않음');
}

if (flood) {
  console.log('시도 제한');
  for (let i = 0; i < 31; i++) await post({ action: 'login', code: 'x' + i });
  ok((await post({ action: 'login', code: c1 })).error === 'too_many', '틀린 코드 31번 뒤에는 맞는 코드도 too_many');
}
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
