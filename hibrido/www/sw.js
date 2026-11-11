// Cache simples para o app funcionar offline como PWA
const CACHE = 'receptor-vlc-v2';
const FILES = [
  './', 'index.html', 'style.css', 'lightsensor.js', 'receiver.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'assets/teste_vlc.txt',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
