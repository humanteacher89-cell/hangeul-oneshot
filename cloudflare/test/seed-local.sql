-- 내 컴퓨터 미리 보기(deploy.py dev)에서만 쓰는 시험 설정·소주제. 공개 D1에는 넣지 않는다.
INSERT OR IGNORE INTO settings (key, value) VALUES ('title', '한글원샷'), ('subtitle', '프랑스 한글학교 레벨별 자료'), ('notice', ''), ('join_code', 'TEST');
INSERT OR IGNORE INTO topics (topic, fr, grp, ord, icon) VALUES ('카페', 'Café', '음식', 20, '☕'), ('약국', 'Pharmacie', '생활', 50, '💊');
-- AI 하루 횟수는 미리 보기를 켤 때마다 비운다(서버 시험을 여러 번 돌려도 한도에 걸리지 않게)
DELETE FROM ai_usage;
