// /api — 한글원샷 서버(읽기·가입·로그인·올리기·삭제·즐겨찾기). 내용은 ../server/app.js
import { handleApi } from '../server/app.js';

export const onRequest = ({ request, env }) => handleApi(request, env);
