-- (2026-10-31) 이미 있는 D1의 소주제 표에 고정 번호 칸을 더한다. 이미 있으면 'duplicate column'으로 실패해도 된다(deploy.py migrate가 넘어감).
ALTER TABLE topics ADD COLUMN qid INTEGER;
