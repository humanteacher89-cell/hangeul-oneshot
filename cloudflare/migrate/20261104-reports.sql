-- 자료 신고 표(2026-11-04, Play 사용자 제작 콘텐츠 정책). 몇 번 돌려도 그대로.
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY,
  material_id TEXT NOT NULL,
  reason      TEXT NOT NULL,
  text        TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL DEFAULT '',
  at          INTEGER NOT NULL,
  who         TEXT NOT NULL DEFAULT '',
  done        TEXT
);
CREATE INDEX IF NOT EXISTS reports_at ON reports (at);
CREATE INDEX IF NOT EXISTS reports_material ON reports (material_id);
