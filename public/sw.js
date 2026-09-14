// Service Worker for TRUNG HẢI HRM PWA
const CACHE_NAME = 'trunghai-hrm-cache-v3.9.35';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/main.css?v=3.9.35',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png'
];

// Listen for messages from client (e.g. skipWaiting, clearCache)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data && event.data.action === 'clearCache') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    });
  }
});

// Install Event - Pre-cache core app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache non-fatal error:', err);
      });
    })
  );
});

// Activate Event - Clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First for Scripts & HTML to avoid stale bugs, Cache fallback for offline
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // For API endpoints or POST/PUT/DELETE: Always Network-Only (No cache)
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: true, message: 'Bạn đang ngoại tuyến. Vui lòng kết nối Internet để cập nhật dữ liệu.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Real-time JSON data files (sample_database.json, mitaco_punches_cache.json): Always Network-First, do NOT store stale
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML Navigation & JavaScript files: Network-First with cache fallback
  if (request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request) || (request.mode === 'navigate' ? caches.match('./index.html') : null))
    );
    return;
  }

  // For CDN / External scripts & Google Fonts: Stale-While-Revalidate
  if (url.origin.includes('cdn.jsdelivr.net') || url.origin.includes('cdnjs.cloudflare.com') || url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Static images & CSS: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      });
    })
  );
});
