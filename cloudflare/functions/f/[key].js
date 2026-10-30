// /f/<키> — 교사가 올린 파일(PDF·사진). 내용은 ../../server/app.js
import { handleFile } from '../../server/app.js';

export const onRequest = ({ request, env, params }) => handleFile(request, env, params.key);
