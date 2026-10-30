// 한글원샷 설정 — 이 파일만 고치면 된다.
window.ONESHOT_CONFIG = {
  // 서버 주소. 새 판(2026-10-30, 가지 v2)은 같은 사이트의 '/api'(Cloudflare 서버 + D1, `cloudflare/`).
  // 옛 판(시트)은 구글 앱스 스크립트 '웹 앱' 주소 https://script.google.com/macros/s/AKfycbwOIqhLetFQyByTA74HrTk_bhTZEeIvPLREwyMhtTP1SD_LcEeLwsUgnbsNv2TJP_k/exec
  // 비워 두면 시험 모드: sample-data.js의 견본 자료를 쓰고, 올린 자료는 이 브라우저에만 저장된다.
  API_URL: "/api",

  TITLE: "한글원샷",
  SUBTITLE: "프랑스 한글학교 레벨별 자료",

  // 레벨은 시트에 적는 글자(하·중·상) 그대로. 설명은 화면에만 보인다.
  LEVELS: [
    { key: "하", ko: "처음 배워요", fr: "Débutant" },
    { key: "중", ko: "문장을 읽고 써요", fr: "Intermédiaire" },
    { key: "상", ko: "긴 글과 이야기", fr: "Avancé" }
  ],

  // 자료 유형(올리기 화면의 선택지). 시트에 다른 말을 적어도 그대로 보여 준다.
  // 2026-10-24 휴먼쌤 "유형은 읽기 쓰기 이건 유형이 아니지. 딱 분류해서 게임/학습지/영상/퀴즈/기타 이렇게만 해줘"
  // 2026-10-25 휴먼쌤 "아 아니야 '활동지'가 맞아" → 학습지를 활동지로(자료 제목 '활동지: …'와 맞게)
  // 2026-10-25 휴먼쌤 "분류기준에 '게임' 대신 '앱'으로 수정해줘"
  TYPES: ["앱", "활동지", "영상", "퀴즈", "기타"],

  // 소속 학교(가입·자료 올리기에서 고른다). 처음엔 XR개발부 '프랑스 한글학교 로비'의 17곳(휴먼쌤 2026-10-06 결정)이었고,
  // 2026-10-24 휴먼쌤 "아직 리옹 학교가 남아있어 빼야돼"로 리옹 에콜리움을 빼 16곳이었다가,
  // 2026-10-25 휴먼쌤 "학교 중에서 에콜리움 한글학교 -> 이게 빠졌어."로 '에콜리움 한글학교'(리옹 2구, Lium École coréenne)를 다시 넣어 17곳.
  // 시트 '자료' 탭 '학교' 칸에는 ko 이름이 그대로 적힌다. 학교를 더하거나 빼려면 이 목록만 고친다. 화면에서는 이름순으로 보인다.
  SCHOOLS: [
    { ko: "파리 한글학교", fr: "École coréenne de Paris", city: "파리", cityFr: "Paris" },
    { ko: "오페라 한글학교", fr: "École coréenne de l'Opéra de Paris", city: "파리", cityFr: "Paris" },
    { ko: "파리 아리솔 한글학교", fr: "École coréenne Arissol", city: "파리", cityFr: "Paris" },
    { ko: "그르노블 한글학교", fr: "Association franco-coréenne de Grenoble et de l'Isère", city: "그르노블", cityFr: "Grenoble" },
    { ko: "스트라스부르 한글학교", fr: "École coréenne de Strasbourg", city: "스트라스부르", cityFr: "Strasbourg" },
    { ko: "툴루즈 한글학교", fr: "École coréenne de Toulouse", city: "툴루즈", cityFr: "Toulouse" },
    { ko: "엑상프로방스 한글학교", fr: "École coréenne d'Aix-en-Provence", city: "엑상프로방스", cityFr: "Aix-en-Provence" },
    { ko: "보르도 한글학교", fr: "École coréenne de Bordeaux", city: "보르도", cityFr: "Bordeaux" },
    { ko: "몽펠리에 한글학교", fr: "École coréenne de Montpellier", city: "몽펠리에", cityFr: "Montpellier" },
    { ko: "클레르몽페랑 한글학교", fr: "École coréenne de Clermont-Ferrand", city: "클레르몽페랑", cityFr: "Clermont-Ferrand" },
    { ko: "낭트 한글학교", fr: "École coréenne de Nantes", city: "낭트", cityFr: "Nantes" },
    { ko: "릴 한글학교", fr: "École coréenne de Lille", city: "릴", cityFr: "Lille" },
    { ko: "투르 한글학교", fr: "École coréenne de Tours", city: "투르", cityFr: "Tours" },
    { ko: "브레스트 한글학교", fr: "École coréenne de Brest", city: "브레스트", cityFr: "Brest" },
    { ko: "마르세유 한글학교", fr: "École coréenne de Marseille", city: "마르세유", cityFr: "Marseille" },
    { ko: "르망 한글학교", fr: "Le Mans École coréenne", city: "르망", cityFr: "Le Mans" },
    { ko: "에콜리움 한글학교", fr: "Lium École coréenne", city: "리옹", cityFr: "Lyon" }
  ]
};
