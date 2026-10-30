-- 내 컴퓨터 미리 보기(deploy.py dev)에서만 쓰는 시험 설정·소주제. 공개 D1에는 넣지 않는다.
INSERT OR IGNORE INTO settings (key, value) VALUES ('title', '한글원샷'), ('subtitle', '프랑스 한글학교 레벨별 자료'), ('notice', ''), ('join_code', 'TEST');
INSERT OR IGNORE INTO topics (topic, fr, grp, ord, icon) VALUES ('카페', 'Café', '음식', 20, '☕'), ('약국', 'Pharmacie', '생활', 50, '💊');
