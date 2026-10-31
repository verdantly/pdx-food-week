const TILE_CACHE_NAME = 'pdxfw-tiles-v1';
const CACHE_NAME = 'pdxfw-cache-b9de70c3';

const LOCAL_ASSETS = [
  './',
  'index.html',
  'css/style.css?v=b9de70c3',
  'js/app.js?v=b9de70c3',
  'js/meta.js?v=b9de70c3',
  'js/modules/auth.js',
  'js/modules/cards.js',
  'js/modules/crawl.js',
  'js/modules/data.js',
  'js/modules/filters.js',
  'js/modules/friends.js',
  'js/modules/install.js',
  'js/modules/map.js',
  'js/modules/picks_exporter.js',
  'js/modules/render.js',
  'js/modules/state.js',
  'js/modules/swipe.js',
  'js/modules/sync.js',
  'js/modules/ui.js',
  'js/modules/utils.js'
];

const VENDOR_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics-compat.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'
];

const STATIC_ASSETS = [...LOCAL_ASSETS, ...VENDOR_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // Fetch local assets with cache: 'no-cache' so SW install always bypasses stale HTTP disk cache
        await Promise.allSettled(
          LOCAL_ASSETS.map((url) =>
            fetch(new Request(url, { cache: 'no-cache' })).then((res) => {
              if (res && res.status === 200) {
                return cache.put(url, res);
              }
            })
          )
        );
        // Cache vendor assets resiliently so a single CDN hiccup never aborts local asset precaching
        await Promise.allSettled(
          VENDOR_ASSETS.map((url) => cache.add(url))
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-http/https requests (e.g. chrome-extension://, moz-extension://)
  if (!url.protocol.startsWith('http')) return;

  const isNavigation = event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const isAppCode = url.pathname.includes('/meta.js') || url.pathname.includes('/app.js') || url.pathname.includes('/modules/');
  const isDataFile = url.pathname.includes('/data/') && url.pathname.endsWith('.js');
  const isCSS = url.pathname.includes('/css/') || url.pathname.endsWith('.css');

  // 1. Navigation requests (HTML / entrypoint): Network-First with cache: 'no-cache'
  // Guarantees online visitors and resumed PWAs immediately receive the latest index.html from server,
  // while seamlessly falling back to cached HTML when offline.
  if (isNavigation) {
    const navRequest = new Request(event.request.url, {
      headers: event.request.headers,
      credentials: event.request.credentials,
      cache: 'no-cache'
    });

    event.respondWith(
      fetch(navRequest)
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
              return caches.match('./', { ignoreSearch: true })
                .then((rootCached) => rootCached || caches.match('index.html', { ignoreSearch: true }));
            });
        })
    );
    return;
  }

  // 2. Unversioned app code & dynamic datasets: Network-First with cache: 'no-cache' revalidation & offline fallback
  // Ensures data/*.js and js/modules/*.js always revalidate with the server (ETag / 304) instead of serving stale disk cache.
  const isUnversionedCode = (isAppCode || isDataFile || isCSS) && !url.searchParams.has('v');
  if (isUnversionedCode) {
    const revalidateReq = new Request(event.request.url, {
      headers: event.request.headers,
      credentials: event.request.credentials,
      cache: 'no-cache'
    });

    event.respondWith(
      fetch(revalidateReq)
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
          return caches.match(event.request, { ignoreSearch: false })
            .then((cached) => cached || caches.match(event.request, { ignoreSearch: true }));
        })
    );
    return;
  }

  // 3. Map tiles (tile.openstreetmap.org): Network-First with cache fallback
  // Ensures fresh tiles when online, but falls back to cached tiles when offline roaming
  const isMapTile = url.hostname.includes('tile.openstreetmap.org');
  if (isMapTile) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const resClone = response.clone();
            caches.open(TILE_CACHE_NAME).then((cache) => {
              cache.put(event.request, resClone).catch(() => {});
              // Bound tile cache to max 400 entries to prevent storage bloat
              cache.keys().then((keys) => {
                if (keys.length > 400) {
                  cache.delete(keys[0]).catch(() => {});
                }
              });
            });
          }
          return response;
        })
        .catch(() => {
          return caches.open(TILE_CACHE_NAME).then((cache) => {
            return cache.match(event.request);
          });
        })
    );
    return;
  }

  // 4. Versioned static assets (?v=...) & CDN vendor libraries:
  // Exact Cache-First (ignoreSearch: false) -> Network fetch (cache: 'no-cache' for local assets) -> Offline fallback (ignoreSearch: true)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      const isLocalOrigin = url.origin === self.location.origin;
      const fetchTarget = isLocalOrigin
        ? new Request(event.request.url, { credentials: event.request.credentials, cache: 'no-cache' })
        : event.request;

      return fetch(fetchTarget)
        .then((response) => {
          if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, resClone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => {
          // Only fall back to ignoreSearch: true when offline and exact version isn't cached
          return caches.match(event.request, { ignoreSearch: true });
        });
    })
  );
});
