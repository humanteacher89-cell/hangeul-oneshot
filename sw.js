// 2026-10-31: 이 GitHub Pages 주소는 새 주소로 넘기는 페이지만 둔다. 예전에 홈 화면에 추가한 기기의 서비스 워커는
// 저장해 둔 옛 화면을 지우고 스스로 물러난다(다음에 열면 넘김 페이지 → https://humanssaem-hangeul-oneshot.pages.dev/).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(list => list.forEach(c => c.navigate(c.url).catch(() => {})))
  );
});
