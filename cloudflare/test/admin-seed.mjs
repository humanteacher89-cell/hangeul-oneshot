// 서버 시험용 관리자 교사 한 명('시험관리자')을 만드는 SQL(2026-10-31, 관리자 화면 시험).
// 코드는 환경 변수 ADMIN_CODE로만 받고(명령 줄·파일에 남기지 않는다) cloudflare/.dev.vars의 CODE_PEPPER로 해시한다(server/app.js codeHash와 같게).
//   ADMIN_CODE=… node cloudflare/test/admin-seed.mjs <나올.sql>
//   wrangler d1 execute hangeul-oneshot --local --file <나올.sql>     (공개 D1에 넣었으면 시험 뒤 D1을 되돌린다 — 저장소 CLAUDE.md)
//   지우기: DELETE FROM teachers WHERE name_key = '시험관리자';
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = process.argv[2], code = String(process.env.ADMIN_CODE || '').trim();
if (!out || !/^\d{8}$/.test(code)) { console.error('나올 파일 이름과 ADMIN_CODE(8자리)를 주세요'); process.exit(2); }
const vars = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.dev.vars'), 'utf8');
const pepper = ((vars.match(/^\s*CODE_PEPPER\s*=\s*(.+?)\s*$/m) || [])[1] || '').replace(/^"|"$/g, '');
if (!pepper) { console.error('.dev.vars에 CODE_PEPPER가 없어요'); process.exit(2); }
const hash = createHmac('sha256', pepper).update('code|' + code).digest('hex');
writeFileSync(out, "INSERT INTO teachers (name, name_key, school, code_hash, active, is_admin, joined) VALUES ('시험관리자', '시험관리자', '시험', '" + hash + "', 1, 1, '2026-10-31') "
  + 'ON CONFLICT (name_key) DO UPDATE SET code_hash = excluded.code_hash, active = 1, is_admin = 1;\n', 'utf8');
console.log('시험관리자 SQL 만듦');
