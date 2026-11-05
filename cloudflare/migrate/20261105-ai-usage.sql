-- AI 도우미 사용량(2026-11-05). 몇 번 돌려도 그대로.
CREATE TABLE IF NOT EXISTS ai_usage (
  day        TEXT NOT NULL,
  teacher_id INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  n          INTEGER NOT NULL DEFAULT 0,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, teacher_id, kind)
);
