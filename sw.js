// 한글원샷 서비스 워커 — 홈 화면에 추가한 앱이 바로 열리게 하는 최소한의 것.
// 늘 인터넷에서 먼저 받는다(고친 화면이 바로 보이게). 인터넷이 끊겼을 때만 저장해 둔 화면을 쓴다.
// 다른 주소(시트 서버 script.google.com, 글꼴·QR 도구 CDN)는 건드리지 않는다. 학습자 정보는 아무것도 저장하지 않는다.
const CACHE = 'oneshot-v1';
const SHELL = ['./', 'index.html', 'config.js', 'sample-data.js', 'manifest.json', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
