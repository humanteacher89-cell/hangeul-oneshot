-- 자료 설명 프랑스어(2026-11-05, AI 도우미 자동 채우기와 올리기 화면에서 채움). 비어 있으면 프랑스어 화면에서도 한국어 설명이 보인다.
ALTER TABLE materials ADD COLUMN descr_fr TEXT NOT NULL DEFAULT '';
