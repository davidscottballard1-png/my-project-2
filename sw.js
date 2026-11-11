const CACHE_NAME = 'reelvault-v36';
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
    (async () => {
      const keys = await caches.keys();
      let deletedOldCache = false;
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            deletedOldCache = true;
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
      // When upgrading from an older Service Worker cache, immediately refresh open app windows into the new build
      if (deletedOldCache && typeof self.clients?.matchAll === 'function') {
        const windowClients = await self.clients.matchAll({ type: 'window' });
        await Promise.all(
          windowClients.map((client) => {
            if (client && typeof client.navigate === 'function' && client.url) {
              return Promise.resolve(client.navigate(client.url)).catch(() => null);
            }
            return null;
          })
        );
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Strictly handle same-origin app shell GET requests only (never cache signed/18+ API JSON or media streams)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Network-First for HTML document navigations so browser/PWA refresh always loads the latest deployed version
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const fresh = await fetch(event.request, { cache: 'no-cache' });
          if (fresh && fresh.ok) {
            cache.put(event.request, fresh.clone());
            return fresh;
          }
        } catch {}
        const cachedNav =
          (await cache.match(event.request)) ||
          (await cache.match('./index.html')) ||
          (await cache.match('./'));
        return cachedNav || Response.error();
      })
    );
    return;
  }

  // Stale-While-Revalidate: serve cached App Shell subresources in 0ms while refreshing in background
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

