// HERO Card service worker: app-shell cache + network-first API reads.
const VERSION = 'hc-v5';
const FONT_CACHE = 'hc-fonts-v1';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/css/theme.css', '/css/nav-auth.css', '/manifest.webmanifest',
  '/js/app.js', '/js/api.js', '/js/i18n.js', '/js/icons.js', '/js/checklist.js', '/js/charts.js',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'clear-api-cache') {
    caches.open(VERSION).then(async (c) => {
      for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith('/api/')) c.delete(req);
    });
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: cache-first so the typography also works offline.
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.endsWith('.csv') || url.pathname.endsWith('/pdf')) return; // downloads: never cache
    // network-first, fall back to last good response (lets the app open offline)
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || new Response(JSON.stringify({ error: 'offline' }), {
          status: 503, headers: { 'Content-Type': 'application/json' },
        })))
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  // static: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
