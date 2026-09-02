// Tamale Market Finder — Service Worker
// Network-first for code (JS/CSS/HTML), cache-first for images

const CACHE_VERSION = 'tmf-v3-20260902';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// App shell — files needed for the app to load
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/maskable-512.png',
  '/cdn-checks.js'
];

// Files that should always fetch from network first (so updates are picked up)
const NETWORK_FIRST = /\.(html|js|css)$/;

// Files that are safe to cache-first (rarely change)
const CACHE_FIRST = /\.(png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf)$/;

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('SW: Some shell assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls — always go to network
  if (url.hostname.includes('supabase.co')) return;

  // Skip cross-origin requests (Leaflet CDN etc) — let browser handle
  if (url.origin !== self.location.origin && !url.hostname.includes('unpkg.com') && !url.hostname.includes('jsdelivr.net')) {
    return;
  }

  // Network-first for HTML, JS, CSS — ensures users always get latest code
  if (NETWORK_FIRST.test(url.pathname) || url.pathname === '/') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Cache-first for images, icons, fonts
  if (CACHE_FIRST.test(url.pathname) || APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && url.origin === self.location.origin) {
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(request).then((cached) => {
        return cached || caches.match('/index.html');
      });
    })
  );
});

// Listen for skipWaiting message from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
