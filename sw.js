// Service worker: red primero (para recibir cambios al tiro) y caché como respaldo offline.
// v2: zancudos + mano con spray + detector de objetos. El modelo y el wasm de MediaPipe (~19 MB)
// no se precargan: se guardan en caché la primera vez que se usan, así después funciona offline.
const CACHE = 'asedio-neon-v2-zancudos';
const SPR = ['zancudo_1', 'zancudo_2', 'zancudo_3', 'zancudo_4', 'zancudo_muerto', 'zancudo_var2', 'zancudo_var3',
  'mano_1', 'mano_2', 'mano_3', 'mano_4', 'mano_5', 'mano_6'].map((n) => `./assets/sprites/${n}.webp`);
const ASSETS = ['./', './index.html', './css/style.css', './js/main.js', './js/layout.js', './js/audio.js', './js/sensors.js', './js/detector.js', './js/extras.js',
  './vendor/three.module.min.js', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', ...SPR];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
