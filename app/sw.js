// PassCerfa Service Worker — minimal PWA cache.
// Cache-first for static assets; network-first (fallback cache) for heavy chunks.

const CACHE = 'passcerfa-v1';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './favicon.svg',
];

// Anchored to the hashed JS chunks produced by Vite under /assets/.
// Avoids loose substring matches (e.g. /orchestrator/i would catch any path
// containing the word "orchestrator", not just our lazy chunk).
const HEAVY_PATTERNS = [
  /\/assets\/prefill-orchestrator-[A-Za-z0-9_-]+\.js$/,
  /\/assets\/orchestrator-[A-Za-z0-9_-]+\.js$/,
  /\/assets\/pdf-pack-[A-Za-z0-9_-]+\.js$/,
  /\/assets\/index-Bff[A-Za-z0-9_-]+\.js$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* tolerate missing assets at install */
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const heavy = HEAVY_PATTERNS.some((re) => re.test(url.pathname));

  if (heavy) {
    // network-first
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || Response.error())),
    );
    return;
  }

  // cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      });
    }),
  );
});
