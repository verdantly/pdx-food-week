const CACHE_NAME = 'pdxfw-cache-v7';

const STATIC_ASSETS = [
  './',
  'index.html',
  'css/style.css?v=10',
  'js/app.js?v=10',
  'js/meta.js?v=10',
  'js/modules/cards.js',
  'js/modules/crawl.js',
  'js/modules/data.js',
  'js/modules/filters.js',
  'js/modules/friends.js',
  'js/modules/map.js',
  'js/modules/render.js',
  'js/modules/state.js',
  'js/modules/swipe.js',
  'js/modules/ui.js',
  'js/modules/utils.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics-compat.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http/https requests (e.g. chrome-extension://, moz-extension://)
  if (!url.protocol.startsWith('http')) return;

  // 1. Network-First strategy for HTML navigation, metadata, app code, CSS, and dynamic week datasets
  const isNavigation = event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const isAppCode = url.pathname.includes('/meta.js') || url.pathname.includes('/app.js') || url.pathname.includes('/modules/');
  const isDataFile = url.pathname.includes('/data/') && url.pathname.endsWith('.js');
  const isCSS = url.pathname.includes('/css/') || url.pathname.endsWith('.css');

  if (isNavigation || isAppCode || isDataFile || isCSS) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, resClone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request, { ignoreSearch: false })
            .then((cached) => {
              if (cached) return cached;
              if (isNavigation) {
                return caches.match('./', { ignoreSearch: true })
                  .then((rootCached) => rootCached || caches.match('index.html', { ignoreSearch: true }));
              }
              return caches.match(event.request, { ignoreSearch: true });
            });
        })
    );
    return;
  }

  // 2. Cache-First (with network fallback & cache population) for versioned static assets & libraries
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return caches.match(event.request, { ignoreSearch: true }).then((fallbackResponse) => {
        if (fallbackResponse) {
          return fallbackResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic' && event.request.method === 'GET') {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, resClone).catch(() => {});
            });
          }
          return response;
        });
      });
    })
  );
});
