// 한글원샷 새 판 서버 시험(2026-10-30). 지금 판 Code.gs 시험(가짜 구글 서비스 13가지·대량 8가지)의 기대값을 실제 서버에 대고 본다.
//   node cloudflare/test/api-test.mjs <주소> <가입 코드> [--flood]
//   예: node cloudflare/test/api-test.mjs http://127.0.0.1:8788 TEST --flood   (내 컴퓨터 미리 보기)
// 시험 교사 둘('시험…' 이름)과 시험 자료를 만들고, 자료는 끝에 지운다. 교사 줄은 남으니 공개 D1에서는 시험 뒤 데이터를 다시 옮긴다.
// --flood: 틀린 코드 31번 → too_many(이 기기는 10분 동안 막히므로 맨 끝에, 내 컴퓨터에서만)
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
const mat = { group: '음식', topic: '카페', level: '하', title: '시험 링크 ' + tag, type: '앱', url: 'https://example.org/' + tag, desc: '한 줄', minutes: 0, school: '보르도 한글학교' };
ok((await post({ action: 'upload', code: c1, material: Object.assign({}, mat, { url: 'ftp://x' }) })).error === 'missing', 'https 아닌 링크 → missing');
ok((await post({ action: 'upload', code: c1, material: Object.assign({}, mat, { title: '' }) })).error === 'missing', '제목 없음 → missing');
ok((await post({ action: 'upload', code: 'nope', material: mat })).error === 'bad_code', '틀린 코드로 올리기 → bad_code');
const u1 = await post({ action: 'upload', code: c1, material: mat });
ok(u1.ok && /^m[0-9a-z]+$/.test(u1.id), '링크 올리기 → id');
d = await data();
const m1 = d.materials.find(m => m.id === u1.id);
ok(m1 && m1.by === '시험' + tag && m1.school === '보르도 한글학교' && m1.level === '하' && m1.date.length === 10, '읽기에 올린이·학교·레벨·날짜가 맞게 나옴');

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

if (flood) {
  console.log('시도 제한');
  for (let i = 0; i < 31; i++) await post({ action: 'login', code: 'x' + i });
  ok((await post({ action: 'login', code: c1 })).error === 'too_many', '틀린 코드 31번 뒤에는 맞는 코드도 too_many');
}
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
