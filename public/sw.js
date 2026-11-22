const CACHE_NAME = 'vl-hub-v9';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/femminile',
  '/femminile.js',
  '/fipav-fallback-64591.js',
  '/fipav-fallback-64854.js',
  '/manifest-femminile.json',
  '/icon-192.png',
  '/logo-ladispoli.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  const isDocumentOrCode =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/app.js' ||
    url.pathname === '/styles.css' ||
    url.pathname.startsWith('/femminile') ||
    url.pathname === '/2df' ||
    url.pathname === '/femminile.js' ||
    url.pathname === '/fipav-fallback-64591.js' ||
    url.pathname === '/fipav-fallback-64854.js';

  if (isDocumentOrCode) {
    const offlineFallbackUrl = (url.pathname.startsWith('/femminile') || url.pathname.startsWith('/2df'))
      ? '/femminile'
      : '/index.html';
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(offlineFallbackUrl)))
    );
    return;
  }

  const isAsset =
    url.pathname.startsWith('/logos/') ||
    url.pathname.startsWith('/pp/') ||
    /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);

  if (isAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
