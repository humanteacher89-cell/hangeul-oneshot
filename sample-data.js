// 견본 자료 — 시험 모드(config.js의 API_URL이 비어 있을 때)에만 쓰인다.
// 실제 운영에서는 구글시트의 '자료'·'주제'·'교사'·'설정' 탭이 이 역할을 한다.
// 링크는 모두 견본(example.org)이다.
window.ONESHOT_SAMPLE = {
  settings: {
    title: "한글원샷",
    subtitle: "프랑스 한글학교 레벨별 자료 (견본)",
    notice: "시험판입니다. 자료 링크는 견본이라 실제 자료가 열리지 않습니다."
  },

  // 교사 코드(시험용). 실제로는 시트 '교사' 탭에서 관리한다. 학교는 처음 고를 값일 뿐, 올릴 때 바꿀 수 있다(config.js SCHOOLS).
  teachers: [
    { code: "1234", name: "김선생", school: "파리 한글학교" },
    { code: "5678", name: "이선생", school: "리옹 에콜리움 한글학교" }
  ],

  // 주제 탭(선택): 순서·프랑스어 이름·묶음
  topics: [
    { topic: "자음과 모음", fr: "Consonnes et voyelles", group: "한글 기초", order: 1 },
    { topic: "받침", fr: "Consonnes finales", group: "한글 기초", order: 2 },
    { topic: "소리 내어 읽기", fr: "Lire à voix haute", group: "한글 기초", order: 3 },
    { topic: "인사하기", fr: "Saluer", group: "일상", order: 10 },
    { topic: "우리 가족", fr: "Ma famille", group: "일상", order: 11 },
    { topic: "음식", fr: "La nourriture", group: "일상", order: 12 },
    { topic: "학교", fr: "L'école", group: "일상", order: 13 },
    { topic: "숫자와 시간", fr: "Les nombres et l'heure", group: "일상", order: 14 },
    { topic: "취미", fr: "Les loisirs", group: "일상", order: 15 },
    { topic: "명절", fr: "Fêtes coréennes", group: "문화", order: 20 },
    { topic: "한복과 옷", fr: "Le hanbok et les vêtements", group: "문화", order: 21 },
    { topic: "노래로 배우기", fr: "Apprendre en chantant", group: "문화", order: 22 },
    { topic: "조사 은/는·이/가", fr: "Particules 은/는·이/가", group: "문법", order: 30 },
    { topic: "과거형 -았/었-", fr: "Le passé -았/었-", group: "문법", order: 31 }
  ],

  // 자료 탭: 한 줄 = 버튼 하나
  materials: [
    { id: "s01", group: "한글 기초", topic: "자음과 모음", level: "하", title: "자음 14개 소리 듣고 따라 하기", type: "듣기", url: "https://example.org/jaeum-sori", desc: "그림을 보며 소리를 따라 해요", minutes: 10, school: "파리 한글학교" },
    { id: "s02", group: "한글 기초", topic: "자음과 모음", level: "하", title: "모음 쓰기 연습지", type: "활동지", url: "https://example.org/moeum-sseugi", desc: "점선을 따라 쓰고 색칠해요", minutes: 15, school: "리옹 에콜리움 한글학교" },
    { id: "s03", group: "한글 기초", topic: "자음과 모음", level: "하", title: "자모 짝 맞추기 게임", type: "게임", url: "https://example.org/jamo-game", desc: "", minutes: 10, school: "스트라스부르 한글학교" },
    { id: "s04", group: "한글 기초", topic: "자음과 모음", level: "중", title: "자모 합쳐서 글자 만들기", type: "쓰기", url: "https://example.org/geulja", desc: "ㄱ+ㅏ=가, 카드를 조합해요", minutes: 15, school: "파리 한글학교" },
    { id: "s05", group: "한글 기초", topic: "받침", level: "하", title: "받침 소리 비교 듣기", type: "듣기", url: "https://example.org/batchim-sori", desc: "'강'과 '간'의 차이", minutes: 10, school: "파리 한글학교" },
    { id: "s06", group: "한글 기초", topic: "받침", level: "중", title: "받침 있는 낱말 받아쓰기", type: "쓰기", url: "https://example.org/batchim-dict", desc: "10문제", minutes: 15, school: "마르세유 한글학교" },
    { id: "s07", group: "한글 기초", topic: "받침", level: "상", title: "겹받침 읽기 규칙 정리", type: "읽기", url: "https://example.org/gyeopbatchim", desc: "ㄳ, ㄵ, ㄺ 읽는 법", minutes: 20, school: "리옹 에콜리움 한글학교" },
    { id: "s08", group: "한글 기초", topic: "소리 내어 읽기", level: "하", title: "짧은 낱말 읽기 카드", type: "읽기", url: "https://example.org/read-cards", desc: "", minutes: 10, school: "툴루즈 한글학교" },
    { id: "s09", group: "일상", topic: "인사하기", level: "하", title: "안녕하세요 노래", type: "영상", url: "https://example.org/hello-song", desc: "따라 부르며 인사말 익히기", minutes: 5, school: "파리 한글학교" },
    { id: "s10", group: "일상", topic: "인사하기", level: "하", title: "인사말 그림 카드", type: "어휘", url: "https://example.org/greeting-cards", desc: "안녕하세요·고맙습니다·미안합니다", minutes: 10, school: "리옹 에콜리움 한글학교" },
    { id: "s11", group: "일상", topic: "인사하기", level: "중", title: "상황에 맞는 인사 고르기 퀴즈", type: "퀴즈", url: "https://example.org/greeting-quiz", desc: "", minutes: 10, school: "스트라스부르 한글학교" },
    { id: "s12", group: "일상", topic: "인사하기", level: "상", title: "높임말 인사 역할놀이 대본", type: "말하기", url: "https://example.org/honorific-roleplay", desc: "할머니께, 선생님께, 친구에게", minutes: 20, school: "파리 한글학교" },
    { id: "s13", group: "일상", topic: "우리 가족", level: "하", title: "가족 노래 듣고 따라 부르기", type: "듣기", url: "https://example.org/family-song", desc: "", minutes: 10, school: "리옹 에콜리움 한글학교" },
    { id: "s14", group: "일상", topic: "우리 가족", level: "하", title: "가족 단어 그림 카드", type: "어휘", url: "https://example.org/family-cards", desc: "엄마·아빠·언니·오빠·동생", minutes: 10, school: "파리 한글학교" },
    { id: "s15", group: "일상", topic: "우리 가족", level: "하", title: "가족 단어 짝 맞추기", type: "게임", url: "https://example.org/family-match", desc: "", minutes: 10, school: "스트라스부르 한글학교" },
    { id: "s16", group: "일상", topic: "우리 가족", level: "중", title: "민수네 가족 이야기 읽기", type: "읽기", url: "https://example.org/minsu-family", desc: "짧은 글 + 질문 3개", minutes: 15, school: "리옹 에콜리움 한글학교" },
    { id: "s17", group: "일상", topic: "우리 가족", level: "중", title: "우리 가족 소개 문장 쓰기", type: "쓰기", url: "https://example.org/family-writing", desc: "활동지, 문장 3개", minutes: 15, school: "파리 한글학교" },
    { id: "s18", group: "일상", topic: "우리 가족", level: "중", title: "짝과 가족 묻고 답하기", type: "말하기", url: "https://example.org/family-talk", desc: "이 사람은 누구예요?", minutes: 10, school: "파리 한글학교" },
    { id: "s19", group: "일상", topic: "음식", level: "하", title: "음식 이름 그림 카드", type: "어휘", url: "https://example.org/food-cards", desc: "", minutes: 10, school: "마르세유 한글학교" },
    { id: "s20", group: "일상", topic: "음식", level: "상", title: "식당에서 주문하기 대화", type: "말하기", url: "https://example.org/restaurant", desc: "역할놀이 대본과 메뉴판", minutes: 20, school: "파리 한글학교" },
    { id: "s21", group: "일상", topic: "음식", level: "상", title: "김치 만드는 법 읽고 순서 맞추기", type: "읽기", url: "https://example.org/kimchi", desc: "", minutes: 20, school: "리옹 에콜리움 한글학교" },
    { id: "s22", group: "일상", topic: "학교", level: "하", title: "교실 물건 이름 찾기", type: "어휘", url: "https://example.org/classroom", desc: "", minutes: 10, school: "툴루즈 한글학교" },
    { id: "s23", group: "일상", topic: "학교", level: "중", title: "시간표 읽고 답하기", type: "읽기", url: "https://example.org/timetable", desc: "", minutes: 15, school: "파리 한글학교" },
    { id: "s24", group: "일상", topic: "숫자와 시간", level: "하", title: "숫자 노래 1~10", type: "영상", url: "https://example.org/numbers-song", desc: "", minutes: 5, school: "리옹 에콜리움 한글학교" },
    { id: "s25", group: "일상", topic: "숫자와 시간", level: "중", title: "몇 시예요? 시계 활동지", type: "활동지", url: "https://example.org/clock", desc: "", minutes: 15, school: "스트라스부르 한글학교" },
    { id: "s26", group: "문화", topic: "명절", level: "하", title: "설날 그림 보고 말하기", type: "말하기", url: "https://example.org/seollal-pictures", desc: "", minutes: 10, school: "파리 한글학교" },
    { id: "s27", group: "문화", topic: "명절", level: "중", title: "추석 이야기 읽기", type: "읽기", url: "https://example.org/chuseok", desc: "", minutes: 15, school: "마르세유 한글학교" },
    { id: "s28", group: "문화", topic: "명절", level: "상", title: "설날 이야기 읽고 질문 만들기", type: "읽기", url: "https://example.org/seollal-story", desc: "긴 글, 질문 만들기 활동", minutes: 20, school: "파리 한글학교" },
    { id: "s29", group: "문화", topic: "한복과 옷", level: "하", title: "옷 이름 색칠 활동지", type: "활동지", url: "https://example.org/clothes-color", desc: "", minutes: 15, school: "리옹 에콜리움 한글학교" },
    { id: "s30", group: "문화", topic: "노래로 배우기", level: "중", title: "동요 가사 빈칸 채우기", type: "듣기", url: "https://example.org/song-gap", desc: "", minutes: 10, school: "파리 한글학교" },
    { id: "s31", group: "문법", topic: "조사 은/는·이/가", level: "중", title: "은/는 고르기 연습", type: "문법", url: "https://example.org/eun-neun", desc: "20문제", minutes: 15, school: "스트라스부르 한글학교" },
    { id: "s32", group: "문법", topic: "조사 은/는·이/가", level: "상", title: "은/는과 이/가 차이 설명 읽기", type: "읽기", url: "https://example.org/particles-diff", desc: "", minutes: 20, school: "파리 한글학교" },
    { id: "s33", group: "문법", topic: "과거형 -았/었-", level: "중", title: "어제 한 일 말하기", type: "말하기", url: "https://example.org/past-talk", desc: "", minutes: 10, school: "리옹 에콜리움 한글학교" }
  ]
};
