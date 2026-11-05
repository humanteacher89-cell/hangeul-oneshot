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
