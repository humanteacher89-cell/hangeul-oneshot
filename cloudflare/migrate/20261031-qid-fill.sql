-- (2026-10-31) 소주제 고정 번호 처음 채우기 · 대주제·부제 프랑스어. 몇 번 돌려도 그대로(번호가 하나라도 있으면 다시 매기지 않는다).
-- 번호는 표에 넣은 차례(rowid)로 1, 2, 3 … — 한 번 매긴 번호는 저장되어 내보내기·되돌리기에도 바뀌지 않는다. 그 뒤 새 소주제는 서버가 qid_seq + 1.
UPDATE topics SET qid = (SELECT COUNT(*) FROM topics t2 WHERE t2.rowid <= topics.rowid)
  WHERE (SELECT COUNT(*) FROM topics WHERE qid IS NOT NULL) = 0;
CREATE UNIQUE INDEX IF NOT EXISTS topics_qid ON topics (qid);
INSERT OR IGNORE INTO settings (key, value) VALUES ('qid_seq', (SELECT COALESCE(MAX(qid), 0) FROM topics));
INSERT OR IGNORE INTO settings (key, value) VALUES ('subtitle_fr', 'Ressources de coréen par niveau pour les écoles coréennes de France');
INSERT OR IGNORE INTO settings (key, value) VALUES ('group_fr', '{"만남":"Rencontres","음식":"Nourriture","쇼핑":"Achats","교통":"Transports","생활":"Vie quotidienne","기초":"Bases","일상":"Quotidien","기타":"Autres"}');
