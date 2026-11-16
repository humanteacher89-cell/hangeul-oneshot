// 올린 뒤 실제 주소 확인 — 묶음(_site/)의 파일을 공개 주소에서 받아 바이트까지 같은지 본다(바로 반영 안 될 수 있어 몇 번 다시 봄).
//   node scripts/verify.mjs _site https://humanssaem-apps.pages.dev
// 다르면 실패로 끝나고, GitHub Actions가 앞 판으로 되돌린다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = path.resolve(process.argv[2] || '_site'), BASE = (process.argv[3] || '').replace(/\/$/, '');
if (!BASE) { console.error('공개 주소가 필요해요'); process.exit(2); }
const SKIP = /^(_redirects|_headers)$/;
const files = [];
(function walk(d) { for (const x of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, x.name); x.isDirectory() ? walk(p) : files.push(p); } })(DIR);
const h = b => crypto.createHash('sha256').update(b).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let bad = [];
for (let round = 1; round <= 6; round++) {
  bad = [];
  for (const f of files) {
    const rel = path.relative(DIR, f).split(path.sep).join('/');
    if (SKIP.test(rel)) continue;
    const url = `${BASE}/${rel.split('/').map(encodeURIComponent).join('/')}`.replace(/\/index\.html$/, '/');
    const r = await fetch(url, { headers: { 'cache-control': 'no-cache' }, redirect: 'follow' }).catch(e => ({ ok: false, status: String(e) }));
    if (!r.ok) { bad.push(`${rel} (${r.status})`); continue; }
    // 받는 도중 연결이 끊겨도(ECONNRESET 등) 멈추지 않고 '아직 다름'으로 세어 다음 차례에 다시 본다(2026-11-17)
    let live; try { live = Buffer.from(await r.arrayBuffer()); } catch (e) { bad.push(`${rel} (받다가 끊김: ${e.cause?.code || e.message})`); continue; }
    if (h(live) !== h(fs.readFileSync(f))) bad.push(`${rel} (내용 다름)`);
  }
  if (!bad.length) { console.log(`실제 주소 확인 끝: 파일 ${files.filter(f => !SKIP.test(path.basename(f))).length}개 모두 같음`); process.exit(0); }
  console.log(`${round}번째: 아직 다른 파일 ${bad.length}개 — 10초 뒤 다시`);
  await sleep(10000);
}
for (const b of bad.slice(0, 30)) console.log(`::error::실제 주소가 다름: ${b}`);
process.exit(1);
