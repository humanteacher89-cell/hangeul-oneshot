-- 한글원샷 새 판 D1 짜임(2026-10-30). 시트 탭을 표로 옮기되, 자료 주인은 이름 대신 교사 번호로 잇는다.
-- 처음 한 번: wrangler d1 execute hangeul-oneshot --remote --file schema.sql (몇 번 돌려도 그대로)

-- 교사('교사' 탭). 로그인 코드는 HMAC-SHA256(CODE_PEPPER) 해시만 둔다(코드 자체는 가입 응답에 한 번만 나간다)
CREATE TABLE IF NOT EXISTS teachers (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  name_key  TEXT NOT NULL UNIQUE,          -- 띄어쓰기를 빼고 소문자(같은 이름 막기)
  school    TEXT NOT NULL DEFAULT '',
  code_hash TEXT NOT NULL UNIQUE,
  active    INTEGER NOT NULL DEFAULT 1,    -- 0 = 끔(시트 활성 칸 N)
  is_admin  INTEGER NOT NULL DEFAULT 0,    -- 관리자 화면(2차)
  joined    TEXT NOT NULL DEFAULT ''       -- 가입일 yyyy-MM-dd(파리)
);

-- 소주제('주제' 탭). grp = 대주제(시트 '묶음'), ord = 순서, qid = 고정 번호(짧은 QR 주소 #/q/<qid>, 이름을 바꿔도 그대로, 다시 쓰지 않음)
-- 이미 있는 D1에 qid를 더할 때: migrate/20261031-qid-add.sql → 20261031-qid-fill.sql (deploy.py migrate)
CREATE TABLE IF NOT EXISTS topics (
  topic TEXT PRIMARY KEY,
  fr    TEXT NOT NULL DEFAULT '',
  grp   TEXT NOT NULL DEFAULT '',
  ord   REAL,
  icon  TEXT NOT NULL DEFAULT '',
  qid   INTEGER
);

-- 자료('자료' 탭 + '지운 자료' 탭). 지운 자료는 deleted에 지운 날짜(되살리기 = deleted를 비움). 보이는 순서는 rowid(넣은 순서)
CREATE TABLE IF NOT EXISTS materials (
  id         TEXT PRIMARY KEY,
  grp        TEXT NOT NULL DEFAULT '',
  topic      TEXT NOT NULL,
  level      TEXT NOT NULL,
  title      TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL,                -- 바깥 링크, 또는 올린 파일이면 '/f/<키>'(주소 앞부분은 내보낼 때 붙인다)
  file_key   TEXT,                         -- 올린 파일의 KV 키
  descr      TEXT NOT NULL DEFAULT '',
  minutes    INTEGER,
  school     TEXT NOT NULL DEFAULT '',
  by_name    TEXT NOT NULL DEFAULT '',     -- 올린이 이름(카드에 보임)
  teacher_id INTEGER,                      -- 올린 교사 번호(주인 가리기)
  date       TEXT NOT NULL DEFAULT '',     -- 올린 날짜
  pub        INTEGER NOT NULL DEFAULT 1,   -- 0 = 숨김(시트 공개 칸 N)
  deleted    TEXT                          -- 지운 날짜
);
CREATE INDEX IF NOT EXISTS materials_file ON materials (file_key);
CREATE INDEX IF NOT EXISTS materials_teacher ON materials (teacher_id);

-- 즐겨찾기(시트에서는 '교사' 탭 6번째 칸). added가 클수록 최근
CREATE TABLE IF NOT EXISTS favs (
  teacher_id  INTEGER NOT NULL,
  material_id TEXT NOT NULL,
  added       INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, material_id)
);

-- 설정('설정' 탭): title·subtitle·notice·join_code. join_code는 공개 자료에 싣지 않는다
-- (2026-10-31) subtitle_fr = 부제 프랑스어, group_fr = 대주제 프랑스어 JSON {대주제: 프랑스어}, qid_seq = 마지막 소주제 번호(공개 안 함)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- 틀린 로그인 코드·가입 코드 시도(who = 기기 주소 해시, at = 시각 ms). 10분 지난 줄은 다음 시도 때 지운다
CREATE TABLE IF NOT EXISTS fails (
  who TEXT NOT NULL,
  at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fails_at ON fails (at);
