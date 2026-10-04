// Offline for the stage: serves the lounge's three r147 CDN scripts from local copies that are byte-identical
// to jsDelivr's (web/worlds/vendor/three@0.147.0/), so the moon still works on venue Wi-Fi with no internet.
// The lounge file itself is untouched; this only answers its requests. Scope: this folder (/worlds/) only.
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (!u.startsWith(CDN)) return;
  const local = new URL('vendor/three@0.147.0/' + u.slice(CDN.length).split('?')[0], self.registration.scope);
  e.respondWith(fetch(local).then(r => (r.ok ? r : fetch(e.request))).catch(() => fetch(e.request)));
});
