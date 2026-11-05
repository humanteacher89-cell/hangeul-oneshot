// 한글원샷 서비스 워커 — 홈 화면에 추가한 앱이 바로 열리게 하는 최소한의 것.
// 늘 인터넷에서 먼저 받는다(고친 화면이 바로 보이게). 인터넷이 끊겼을 때만 저장해 둔 화면을 쓴다.
// 다른 주소(글꼴 CDN)와 서버 주소(/api 자료, /f/ 올린 파일, /go/ 자료 QR 넘기기)는 건드리지 않는다. 학습자 정보는 아무것도 저장하지 않는다.
// QR 그리기 도구는 저장소 안 vendor/(2026-10-31) — 끊긴 교실에서도 QR 화면이 그려지게 미리 받아 둔다. 견본 자료는 시험 모드에서만 쓰여 받지 않는다.
const CACHE = 'oneshot-v32';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.json', 'vendor/qrcode.min.js', 'icons/icon-192.png', 'icons/logo-h.svg', 'icons/symbol.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin || /^\/(api|f|go)(\/|$)/.test(u.pathname)) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
