// 올리기 전 점검 — 하나라도 걸리면 올리지 않는다(공개판은 그대로).
//   node scripts/check.mjs site
// 막는 것: 꼭 있어야 할 파일이 없음 · 비밀 값처럼 보이는 글 · 이 PC 경로 · 25MB 넘는 파일(Cloudflare 한도) · 파일 2만 개 넘음
// 알리기만 하는 것: 사이트 안 링크가 가리키는 파일이 없음(옛 앱에 원래 있던 것일 수 있어 막지는 않음)
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2] || '_site');
const MUST = ['index.html', 'config.js', 'sample-data.js', 'manifest.json', 'sw.js', 'privacy.html', 'terms.html', '.well-known/assetlinks.json'];
const TEXT = /\.(html?|js|mjs|css|json|txt|xml|svg|webmanifest|md)$|^_redirects$|^_headers$/i;
const BAD = [
  [/sk-ant-[A-Za-z0-9_-]{16,}/, 'Anthropic 열쇠처럼 보임'],
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, 'GitHub 열쇠처럼 보임'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '비밀 열쇠 파일처럼 보임'],
  [/CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{30,}/, 'Cloudflare 열쇠처럼 보임'],
  [/[A-Za-z]:\\Users\\[^\\\s"'<>]+\\Desktop/i, '이 PC 경로가 들어 있음'],
];
const MAX = 25 * 1024 * 1024;

const files = [];
(function walk(d) { for (const x of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, x.name); x.isDirectory() ? walk(p) : files.push(p); } })(DIR);
const rel = p => path.relative(DIR, p).split(path.sep).join('/');
const errors = [], warns = [];

for (const m of MUST) if (!fs.existsSync(path.join(DIR, m))) errors.push(`꼭 있어야 할 파일이 없음: ${m}`);
if (files.length > 20000) errors.push(`파일이 너무 많음: ${files.length}개(한도 2만)`);
const all = new Set(files.map(rel));
for (const f of files) {
  const r = rel(f), st = fs.statSync(f);
  if (st.size > MAX) errors.push(`25MB 넘는 파일: ${r} (${(st.size / 1048576).toFixed(1)}MB)`);
  if (!TEXT.test(path.basename(f))) continue;
  const t = fs.readFileSync(f, 'utf8');
  for (const [re, why] of BAD) if (re.test(t)) errors.push(`${why}: ${r}`);
  if (/\.html?$/i.test(f)) {
    for (const m of t.matchAll(/\b(?:href|src)\s*=\s*["']([^"'#?]+)/gi)) {
      const u = m[1].trim();
      if (!u || /^(?:[a-z]+:|\/\/|data:|\{\{|\$\{)/i.test(u)) continue;
      let target = u.startsWith('/') ? u.slice(1) : path.posix.join(path.posix.dirname(r), u);
      target = path.posix.normalize(decodeURI(target));
      if (target.startsWith('..')) continue;
      const ok = all.has(target) || all.has(path.posix.join(target, 'index.html')) || all.has(target.replace(/\/$/, '') + '/index.html') || all.has(target + '.html');
      if (!ok) warns.push(`링크가 가리키는 파일 없음: ${r} → ${u}`);
    }
  }
}
for (const w of [...new Set(warns)].slice(0, 30)) console.log(`::warning::${w}`);
if (errors.length) { for (const e of errors) console.log(`::error::${e}`); console.log(`\n점검에 걸림 ${errors.length}건 — 올리지 않음(공개판은 그대로)`); process.exit(1); }
console.log(`점검 통과: 파일 ${files.length}개 · 알림 ${new Set(warns).size}건`);
