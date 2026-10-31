# 시트 → D1 옮기기 SQL 만들기(2026-10-30). 공개 자료(자료·주제·설정)는 지금 판 시트 서버(doGet)에서 그대로 받고,
# 공개에 안 나오는 것(교사·숨긴 자료·지운 자료·가입 코드)은 비공개 JSON에서 읽는다. 로그인 코드는 cloudflare/.dev.vars의
# CODE_PEPPER로 해시해 넣는다(코드 자체는 SQL에 없다. 같은 CODE_PEPPER를 Pages 비밀로도 넣어 둔다).
#   python -X utf8 cloudflare/migrate/sheet_to_sql.py --private <비공개.json> --out <나올.sql> [--public <시트 서버 주소 또는 JSON 파일>]
# 비공개 JSON(저장소에 올리지 않는다, 쓰고 바로 지운다):
#   {"join_code": "…",
#    "teachers": [[이름, 학교, 코드, 활성, 가입일, 즐겨찾기], …]   ← '교사' 탭 순서 그대로, 첫 줄이 관리자(휴먼쌤)
#    "hidden":   [[id, 묶음, 주제, 레벨, 제목, 유형, 링크, 설명, 시간, 학교, 올린이, 올린날짜, 공개], …]   ← 공개 N 줄
#    "deleted":  [[… 위와 같고 끝에 지운날짜], …]}   ← '지운 자료' 탭
# 나온 SQL은 표를 모두 비우고 다시 채운다: wrangler d1 execute hangeul-oneshot --remote --file <나올.sql>
import argparse, hashlib, hmac, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CF = os.path.dirname(HERE)
SHEET_API = 'https://script.google.com/macros/s/AKfycbwOIqhLetFQyByTA74HrTk_bhTZEeIvPLREwyMhtTP1SD_LcEeLwsUgnbsNv2TJP_k/exec'
KEYS = ['id', 'group', 'topic', 'level', 'title', 'type', 'url', 'desc', 'minutes', 'school', 'by', 'date', 'pub']


def pepper():
    path = os.path.join(CF, '.dev.vars')
    for line in open(path, encoding='utf-8'):
        k, _, v = line.strip().partition('=')
        if k.strip() == 'CODE_PEPPER' and v.strip():
            return v.strip().strip('"')
    sys.exit('.dev.vars에 CODE_PEPPER가 없어요')


def code_hash(p, code):   # server/app.js codeHash와 같게: HMAC-SHA256(CODE_PEPPER, 'code|' + 코드) 16진수
    return hmac.new(p.encode('utf-8'), ('code|' + code).encode('utf-8'), hashlib.sha256).hexdigest()


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def s(v):
    return '' if v is None else str(v).strip()


def num(v):
    try:
        n = float(s(v))
        return int(n) if n == int(n) else n
    except ValueError:
        return None


def load_public(src):
    if re.match(r'^https?://', src):
        with urllib.request.urlopen(src + '?action=data&t=' + str(int(time.time())), timeout=120) as r:
            return json.loads(r.read().decode('utf-8'))
    return json.load(open(src, encoding='utf-8'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--private', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--public', default=SHEET_API)
    a = ap.parse_args()
    pub, priv, pep = load_public(a.public), json.load(open(a.private, encoding='utf-8')), pepper()
    if not pub.get('ok'):
        sys.exit('시트 서버 응답이 이상해요')
    out, now = ['DELETE FROM favs;', 'DELETE FROM materials;', 'DELETE FROM topics;', 'DELETE FROM teachers;', 'DELETE FROM settings;', 'DELETE FROM fails;'], int(time.time() * 1000)

    settings = dict(pub.get('settings') or {})
    settings['join_code'] = s(priv.get('join_code'))
    for k, v in settings.items():
        out.append(f'INSERT INTO settings (key, value) VALUES ({q(k)}, {q(s(v))});')

    # qid(소주제 고정 번호, 2026-10-31): 시트 차례대로 1, 2, 3 … — 이미 QR을 인쇄한 뒤 다시 옮기면 번호가 달라질 수 있으니 그때는 D1의 번호를 먼저 확인
    qid = 0
    for t in pub.get('topics') or []:
        if s(t.get('topic')):
            qid += 1
            out.append('INSERT INTO topics (topic, fr, grp, ord, icon, qid) VALUES ({}, {}, {}, {}, {}, {});'.format(
                q(s(t['topic'])), q(s(t.get('fr'))), q(s(t.get('group'))), q(num(t.get('order'))), q(s(t.get('icon'))), qid))
    out.append(f"INSERT OR REPLACE INTO settings (key, value) VALUES ('qid_seq', '{qid}');")

    names, keys, fav_n = {}, set(), 0
    for i, r in enumerate(priv.get('teachers') or []):
        r = list(r) + [''] * 6
        tid, name, code = i + 1, s(r[0]), s(r[2])
        if not name or not code:
            continue
        key = re.sub(r'\s+', '', name).lower()
        if key in keys:
            key += '#' + str(tid)
        keys.add(key)
        names.setdefault(name, tid)
        out.append('INSERT INTO teachers (id, name, name_key, school, code_hash, active, is_admin, joined) VALUES ({}, {}, {}, {}, {}, {}, {}, {});'.format(
            tid, q(name), q(key), q(s(r[1])), q(code_hash(pep, code)), 0 if s(r[3]).upper() == 'N' else 1, 1 if i == 0 else 0, q(s(r[4]))))
        for j, mid in enumerate(x.strip() for x in s(r[5]).split(',') if x.strip()):
            out.append(f'INSERT OR IGNORE INTO favs (teacher_id, material_id, added) VALUES ({tid}, {q(mid)}, {now - j});')
            fav_n += 1

    # 자료: 시트 서버가 준 공개 줄 순서 그대로, 숨긴 줄은 id(만든 시각) 자리에 끼우고, 지운 줄은 끝에
    mats = [dict(m) for m in pub.get('materials') or []]
    for h in priv.get('hidden') or []:
        h = dict(zip(KEYS, h))
        at = next((i for i, m in enumerate(mats) if s(m.get('id')) > s(h['id'])), len(mats))
        mats.insert(at, h)
    dels = []
    for d in priv.get('deleted') or []:
        m = dict(zip(KEYS, d)); m['deleted'] = s(d[13]) if len(d) > 13 else time.strftime('%Y-%m-%d')
        dels.append(m)
    nh = 0
    for m in mats + dels:
        by = s(m.get('by')); hidden = s(m.get('pub')).upper() == 'N'; nh += hidden
        out.append('INSERT INTO materials (id, grp, topic, level, title, type, url, file_key, descr, minutes, school, by_name, teacher_id, date, pub, deleted) '
                   'VALUES ({}, {}, {}, {}, {}, {}, {}, NULL, {}, {}, {}, {}, {}, {}, {}, {});'.format(
                       q(s(m['id'])), q(s(m.get('group'))), q(s(m.get('topic'))), q(s(m.get('level'))), q(s(m.get('title'))), q(s(m.get('type'))),
                       q(s(m.get('url'))), q(s(m.get('desc'))), q(num(m.get('minutes')) or None), q(s(m.get('school'))), q(by), q(names.get(by)),
                       q(s(m.get('date'))), 0 if hidden else 1, q(m.get('deleted'))))

    with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')
    nomatch = sorted({s(m.get('by')) for m in mats + dels if s(m.get('by')) not in names})
    print(f'설정 {len(settings)} · 소주제 {len(pub.get("topics") or [])} · 교사 {len(names)} · 자료 {len(mats)}(숨김 {nh}) · 지운 자료 {len(dels)} · 즐겨찾기 {fav_n}')
    if nomatch:
        print('교사 줄이 없는 올린이(주인은 이름으로 가림):', ', '.join(nomatch))


if __name__ == '__main__':
    main()
