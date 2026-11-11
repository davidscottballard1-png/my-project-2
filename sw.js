const CACHE_NAME = 'reelvault-v31';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './ReelVault.mobileconfig'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: 'no-cache' }).then((res) => {
            if (res && res.ok) {
              return cache.put(url, res);
            }
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Strictly handle same-origin app shell GET requests only (never cache signed/18+ API JSON or media streams)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Stale-While-Revalidate: serve cached App Shell in 0ms on boot while refreshing in background
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached =
        (await cache.match(event.request)) ||
        (await cache.match(event.request, { ignoreSearch: true }));

      const networkUpdate = fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkUpdate);
        return cached;
      }

      const fresh = await networkUpdate;
      return fresh || Response.error();
    })
  );
});

