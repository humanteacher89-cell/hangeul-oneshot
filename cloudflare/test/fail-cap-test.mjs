// 틀린 시도 전체 300번 막기 시험(2026-11-17 보안 점검). 내 컴퓨터 미리 보기(deploy.py dev)에서만 — 머리글 CF-Connecting-IP로 여러 기기를 흉내 낸다
// (공개 서버에서는 Cloudflare가 이 머리글을 정하므로 흉내 낼 수 없다). 기기별 30번 막기는 api-test.mjs --flood가 본다.
//   ADMIN_CODE=<시험관리자 코드> node cloudflare/test/fail-cap-test.mjs http://127.0.0.1:8788 TEST
// 보는 것: 여러 기기가 나눠 틀려 전체 300번이 넘어도 ① 이 10분에 틀린 적 없는 기기는 맞는 코드로 들어가고 가입도 되며
//   ② 틀린 적 있는 기기는 맞는 코드도 too_many. 시험 기기 주소는 10.77.x.x(돌릴 때마다 다르게). 이 시험 뒤 10분 동안은 그 기기들만 막힌다.
const [base, joinCode] = process.argv.slice(2);
const A = String(process.env.ADMIN_CODE || '').trim();
if (!base || !joinCode || !A) { console.error('주소 · 가입 코드 · ADMIN_CODE를 주세요'); process.exit(2); }
const API = base.replace(/\/$/, '') + '/api';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  통과 ' : '  실패 ') + m); };
const post = async (body, ip) => (await fetch(API, { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify(body) })).json();
const run = Date.now() % 200 + 20, ip = (a, b) => `10.77.${run + a}.${b}`;

// 기기마다 29번까지만(기기별 30번 막기에 안 걸리게) 틀리며 전체 300번에 걸릴 때까지
let n = 0, capped = false;
for (let d = 1; d <= 20 && !capped; d++) {
  for (let i = 0; i < 29; i++) {
    const e = (await post({ action: 'login', code: '0000' + (1000 + i) }, ip(0, d))).error;
    if (e === 'too_many') { capped = true; break; }
    if (e === 'bad_code') n++;
  }
}
ok(capped, `여러 기기가 나눠 틀리다 전체 300번에 걸림(이 시험에서 틀린 시도 ${n}번, 기기마다 29번 이하)`);
ok((await post({ action: 'login', code: A }, ip(1, 1))).ok === true, '전체 300번이 넘어도 이 10분에 틀린 적 없는 기기는 맞는 코드로 들어감');
ok((await post({ action: 'join', joinCode, name: '시험막기' + run, school: '파리 한글학교', agree: true }, ip(1, 2))).ok === true, '틀린 적 없는 기기는 가입도 됨');
ok((await post({ action: 'login', code: A }, ip(0, 1))).error === 'too_many', '틀린 적 있는 기기는 맞는 코드도 too_many');
ok((await post({ action: 'login', code: '00000001' }, ip(1, 3))).error === 'bad_code', '처음 틀리는 기기는 bad_code(한 번은 받음)');
ok((await post({ action: 'login', code: A }, ip(1, 3))).error === 'too_many', '그 기기도 한 번 틀린 뒤에는 too_many');
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
