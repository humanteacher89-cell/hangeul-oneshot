// Cloudflare Pages 공개판 번호 보기 · 되돌리기(GitHub Actions에서 저장소 비밀 CLOUDFLARE_API_TOKEN으로)
//   node scripts/cf.mjs current            → 지금 공개판 배포 번호
//   node scripts/cf.mjs previous           → 지금 공개판 바로 앞 판의 번호
//   node scripts/cf.mjs rollback <번호>     → 그 판으로 되돌리기
const ACC = process.env.CLOUDFLARE_ACCOUNT_ID, TOK = process.env.CLOUDFLARE_API_TOKEN, PROJ = process.env.PROJECT;
if (!ACC || !TOK || !PROJ) { console.error('CLOUDFLARE_ACCOUNT_ID · CLOUDFLARE_API_TOKEN · PROJECT가 필요해요'); process.exit(2); }
const base = `https://api.cloudflare.com/client/v4/accounts/${ACC}/pages/projects/${PROJ}`;
const call = async (p, method = 'GET') => {
  const r = await fetch(base + p, { method, headers: { Authorization: `Bearer ${TOK}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return j.result;
};
const [cmd, id] = process.argv.slice(2);
if (cmd === 'current') {
  const p = await call('');
  const cur = p.canonical_deployment || p.latest_deployment;
  console.log(cur && cur.id ? cur.id : 'none');   // 새 집이면 아직 공개판이 없다
} else if (cmd === 'previous') {   // 지금 공개판 바로 앞의 공개판 번호
  const p = await call('');
  const cur = (p.canonical_deployment || {}).id;
  const list = (await call('/deployments?env=production&per_page=25')).filter(d => d.environment === 'production');
  const i = list.findIndex(d => d.id === cur);
  const prev = i >= 0 ? list[i + 1] : null;
  if (!prev) throw new Error('앞 판을 못 찾음');
  console.log(prev.id);
} else if (cmd === 'rollback') {
  if (id === 'none') { console.log('앞 판이 없어 되돌리지 않음(첫 올리기)'); process.exit(0); }
  if (!/^[0-9a-f-]{36}$/.test(id || '')) throw new Error('되돌릴 번호가 이상함: ' + id);
  await call(`/deployments/${id}/rollback`, 'POST');
  console.log('되돌림: ' + id);
} else { console.error('current 또는 rollback <번호>'); process.exit(2); }
