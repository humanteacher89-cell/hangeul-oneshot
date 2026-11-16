// /api — 한글원샷 서버(읽기·가입·로그인·올리기·삭제·즐겨찾기). 내용은 ../server/app.js
import { handleApi } from '../server/app.js';

// waitUntil: 10분 지난 기기 주소 해시를 응답 뒤에 지운다(2026-11-17, app.js purgeStale)
export const onRequest = ({ request, env, waitUntil }) => handleApi(request, env, waitUntil);
