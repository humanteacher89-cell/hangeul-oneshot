// /go/<자료 id> — 자료별 QR이 담는 주소. 지금 링크로 302 넘긴다(숨김·지운 자료는 그 소주제 화면으로). 내용은 ../../server/app.js
import { handleGo } from '../../server/app.js';

export const onRequest = ({ request, env, params }) => handleGo(request, env, params.id);
