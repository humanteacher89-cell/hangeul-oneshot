// 내 컴퓨터 서버 시험용 가짜 Anthropic API(2026-11-05). 실제 Claude를 부르지 않고 서버 코드(SDK 호출·오류 처리·저장)를 끝까지 돌린다.
//   node cloudflare/test/fake-anthropic.mjs [포트, 기본 8799]
//   cloudflare/.dev.vars: ANTHROPIC_API_KEY=test-fake-key · AI_BASE_URL=http://127.0.0.1:8799
// 요청을 기록해 GET /__log로 돌려준다(api-test.mjs가 모양을 맞춰 본다). 글에 [[429]] [[401]] [[529]] [[credit]] [[refusal]] [[max_tokens]] [[badjson]]이 있으면 그 오류를 흉내 낸다.
// 실제 API가 스키마·파일 참조를 받아 주는지는 여기서 알 수 없다(실제 키로 한 번 확인해야 한다).
import http from 'node:http';

const port = Number(process.argv[2] || 8799);
const log = [];
const files = new Set();
const send = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const apiError = (res, status, type, message) => send(res, status, { type: 'error', error: { type, message }, request_id: 'req_fake' });
const message = (obj, stop) => ({ id: 'msg_fake', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop || 'end_turn', stop_sequence: null,
  content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], usage: { input_tokens: 1000, output_tokens: 200 } });

function answer(body) {
  const props = Object.keys((((body.output_config || {}).format || {}).schema || {}).properties || {});
  if (props.includes('picks')) {
    const ids = [...String(JSON.stringify(body.messages)).matchAll(/\\n(m[0-9a-z]+) \|/g)].map(m => m[1]);
    return { intro: '이 수업에 맞는 자료예요.', picks: [{ id: ids[0] || 'nope', why: '주제가 같아요.' }, { id: 'unknown-id', why: '목록에 없는 자료' }, { id: ids[0] || 'nope', why: '겹침' }], gap: '말하기 카드가 더 있으면 좋겠어요.' };
  }
  if (props.includes('passage')) {
    const asked = JSON.stringify(body.messages);
    // 문서 모양 확인용(words 칸에 적는다): [[ws-cafe]] 실제 Claude가 쓴 초안 하나, [[ws-long]] 쪽을 넘는 긴 글·문항 10개, [[ws-write]] 본문 없이 쓰기 문항만(정답 쪽 없음)
    if (asked.includes('[[ws-cafe]]')) {
      return { title: '카페에 가요', desc: '카페 이야기를 읽고 알맞은 답을 골라요.', desc_fr: 'Lis l’histoire au café et choisis la bonne réponse.', guide: '글을 잘 읽고 알맞은 것을 하나 골라요.', guide_fr: 'Lis bien le texte et choisis une seule bonne réponse.',
        passage: '오늘은 토요일이에요. 민지는 엄마와 같이 카페에 갔어요. 카페는 학교 옆에 있어요. 카페 직원이 웃으면서 주문을 받았어요. 엄마는 따뜻한 커피를 주문했어요. 민지는 커피를 안 마셔요. 그래서 시원한 딸기 주스를 주문했어요. 그리고 초콜릿 케이크도 하나 샀어요. 카페 안에는 사람이 아주 많았어요. 민지와 엄마는 창문 옆 자리에 앉았어요. 케이크가 정말 맛있었어요.',
        items: [{ q: '민지는 카페에서 무엇을 마셨어요?', fr: 'Qu’est-ce que Minji a bu au café ?', choices: ['따뜻한 커피', '딸기 주스', '우유', '녹차'], answer: '딸기 주스' },
          { q: '이 사람은 카페에서 일해요. 주문을 받고 음료를 만들어요. 이 사람은 누구예요?', fr: 'Cette personne travaille au café. Elle prend les commandes et prépare les boissons. Qui est-ce ?', choices: ['선생님', '카페 직원', '경찰관', '학생'], answer: '카페 직원' },
          { q: '민지와 엄마는 어디에 앉았어요?', fr: 'Où Minji et sa maman se sont-elles assises ?', choices: ['문 옆 자리', '창문 옆 자리', '카페 밖', '학교 안'], answer: '창문 옆 자리' }] };
    }
    if (asked.includes('[[ws-long]]')) {
      const para = '오늘은 토요일이에요. 민지는 엄마와 같이 시장에 갔어요. 시장에는 사과와 배, 생선과 채소를 파는 가게가 아주 많았어요. 민지는 처음 보는 과일을 보고 이름을 물어봤어요. 가게 아주머니가 웃으면서 맛을 보게 해 주셨어요. ';
      return { title: '시장에서 물건을 사고 이야기를 나누는 아주 긴 제목의 활동지 초안이에요', desc: '긴 글을 읽고 내용을 확인해요. 문항이 많아 여러 쪽으로 나뉘어요.', desc_fr: 'Lis un long texte et vérifie ta compréhension. Le document tient sur plusieurs pages.', guide: '글을 잘 읽고 알맞은 것을 골라요.', guide_fr: 'Lis bien le texte et choisis la bonne réponse.', passage: Array.from({ length: 9 }, (_, i) => para.repeat(3).trim() + ' (' + (i + 1) + ')').join('\n'),
        items: Array.from({ length: 10 }, (_, i) => ({ q: i % 3 === 2 ? '이 글에서 가장 기억에 남는 장면을 고르고, 왜 그렇게 생각했는지 자기 말로 짧게 이어서 설명해 보세요.' : '민지는 시장에서 무엇을 물어봤어요?', fr: i % 3 === 2 ? 'Choisis la scène qui t’a le plus marqué et explique pourquoi avec tes propres mots.' : 'Qu’est-ce que Minji a demandé au marché ?',
          choices: i % 3 === 0 ? ['과일 이름', '생선 값', '가게 이름', '집에 가는 길'] : i % 3 === 1 ? ['가게 아주머니가 웃으면서 맛을 보게 해 주셨어요', '엄마가 큰 사과를 한 봉지 샀어요', '민지가 혼자 시장에 갔어요', '시장에 사람이 아무도 없었어요', '비가 와서 집으로 돌아갔어요', '민지가 생선을 샀어요'] : [], answer: i % 3 === 2 ? '' : '과일 이름' })) };
    }
    if (asked.includes('[[ws-write]]')) {
      return { title: '내 문장 만들기', desc: '', desc_fr: '', guide: '낱말로 문장을 만들어 써요.', guide_fr: 'Écris une phrase avec chaque mot.', passage: '',
        items: [{ q: '‘사과’로 문장을 써요.', fr: 'pomme', choices: [], answer: '' }, { q: '‘학교’로 문장을 써요.', fr: 'école', choices: [], answer: '' }] };
    }
    return { title: '편의점에서 물건 사기', desc: '편의점 낱말을 익혀요', desc_fr: 'Apprendre les mots de la supérette', guide: '알맞은 낱말을 골라요.', guide_fr: 'Choisis le bon mot.', passage: '가: 이거 얼마예요?\n나: 천 원이에요.',
      items: [{ q: '‘물’은 어느 것이에요?', fr: 'Lequel est « eau » ?', choices: ['물', '빵', '우유'], answer: '물' }, { q: '내가 사고 싶은 것을 써요.', fr: 'Écris ce que tu veux acheter.', choices: [], answer: '' }] };
  }
  return { title: '편의점 낱말 카드', type: '활동지', level: '하', desc: '그림을 보며 편의점 낱말을 익혀요', desc_fr: 'Apprendre les mots de la supérette', topic: '카페', group: '', why: '낱말 중심이라 하 레벨로 봤어요.' };
}

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks), url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/__log') return send(res, 200, { log, files: [...files] });
    if (req.method === 'POST' && url.pathname === '/__clear') { log.length = 0; return send(res, 200, { ok: true }); }
    // SDK 1.x는 API 키를 Authorization: Bearer로 보낸다(옛 판과 curl 예시는 x-api-key)
    if (req.headers.authorization !== 'Bearer test-fake-key' && req.headers['x-api-key'] !== 'test-fake-key') { log.push({ path: 'unauthorized ' + req.method + ' ' + url.pathname, headerNames: Object.keys(req.headers) }); return apiError(res, 401, 'authentication_error', 'invalid key'); }
    if (req.method === 'POST' && url.pathname === '/v1/files') {
      const id = 'file_fake' + (log.length + 1);
      files.add(id);
      log.push({ path: '/v1/files', size: raw.length, multipart: /multipart\/form-data/.test(req.headers['content-type'] || ''), type: (raw.toString('latin1').match(/Content-Type: ([a-z]+\/[a-z.+-]+)\r\n\r\n/) || [])[1] || '' });
      return send(res, 200, { id, type: 'file', filename: 'f', mime_type: 'application/pdf', size_bytes: raw.length, created_at: new Date().toISOString() });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/v1/files/')) {
      const id = url.pathname.split('/').pop();
      files.delete(id);
      log.push({ path: 'DELETE /v1/files', id });
      return send(res, 200, { id, type: 'file_deleted' });
    }
    if (req.method === 'POST' && url.pathname === '/v1/messages') {
      let body; try { body = JSON.parse(raw.toString('utf8')); } catch (e) { return apiError(res, 400, 'invalid_request_error', 'bad json'); }
      const text = JSON.stringify(body.messages);
      log.push({ path: '/v1/messages', beta: req.headers['anthropic-beta'] || '', version: req.headers['anthropic-version'] || '', body });
      if (text.includes('[[429]]')) return apiError(res, 429, 'rate_limit_error', 'slow down');
      if (text.includes('[[401]]')) return apiError(res, 401, 'authentication_error', 'revoked');
      if (text.includes('[[529]]')) return apiError(res, 529, 'overloaded_error', 'overloaded');
      if (text.includes('[[credit]]')) return apiError(res, 400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.');
      if (text.includes('[[refusal]]')) return send(res, 200, message('', 'refusal'));
      if (text.includes('[[max_tokens]]')) return send(res, 200, message('{"title":"잘', 'max_tokens'));
      if (text.includes('[[badjson]]')) return send(res, 200, message('이건 JSON이 아니에요'));
      return send(res, 200, message(answer(body)));
    }
    apiError(res, 404, 'not_found_error', 'no such path');
  });
}).listen(port, '127.0.0.1', () => console.log('가짜 Anthropic API http://127.0.0.1:' + port));
