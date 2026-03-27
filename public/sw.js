// Service Worker для оффлайн-режима
const CACHE_NAME = 'stwarehouse-v9';
const STATIC_CACHE = 'stwarehouse-static-v9';
const ASSETS_CACHE = 'stwarehouse-assets-v9';

// Критические ресурсы для кэширования при установке
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico'
];

// При установке кэшируем критические ресурсы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// При активации чистим старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_NAME) && !name.includes(STATIC_CACHE) && !name.includes(ASSETS_CACHE))
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Проверяем, является ли запрос навигационным
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && 
          request.headers.get('accept')?.includes('text/html'));
}

// Проверяем, является ли запрос asset'ом Vite
function isViteAsset(url) {
  return url.pathname.startsWith('/assets/') ||
         url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/);
}

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 1. API запросы к Supabase, Яндекс Диск и Google Fonts — пропускаем
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('yandex.') || 
      url.hostname.includes('googleapis.com') || 
      url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline', queued: true }),
          { 
            status: 503, 
            headers: { 'Content-Type': 'application/json' },
            statusText: 'Service Unavailable'
          }
        );
      })
    );
    return;
  }
  
  // 2. Навигационные запросы (HTML) — Stale While Revalidate
  if (isNavigationRequest(request)) {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Нет сети — возвращаем кэш или ошибку
          return cached || new Response('Offline - no cached page', { status: 503 });
        });
        
        // Возвращаем кэш сразу, параллельно обновляем
        return cached || fetchPromise;
      })
    );
    return;
  }
  
  // 3. Assets Vite (JS, CSS, шрифты, иконки) — Cache First (только GET)
  if (request.method === 'GET' && isViteAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Есть в кэше — возвращаем, но параллельно проверяем обновление
          fetch(request).then((networkResponse) => {
            // Кэшируем только если получили валидный JS/CSS (не HTML)
            if (networkResponse && networkResponse.status === 200) {
              const contentType = networkResponse.headers.get('content-type');
              if (contentType && (contentType.includes('javascript') || contentType.includes('css'))) {
                const responseClone = networkResponse.clone();
                caches.open(ASSETS_CACHE).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
            }
          }).catch(() => {});
          return cached;
        }
        
        // Нет в кэше — загружаем и кэшируем только валидные ответы
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type');
            // Не кэшируем если получили HTML вместо JS/CSS
            if (contentType && !contentType.includes('text/html')) {
              const responseClone = networkResponse.clone();
              caches.open(ASSETS_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
          }
          return networkResponse;
        }).catch(() => {
          return new Response('Asset not available offline', { status: 408 });
        });
      })
    );
    return;
  }
  
  // 4. Остальные GET-запросы — Network First с fallback к кэшу
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(ASSETS_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(request);
      })
    );
  }
  // POST/PUT/DELETE запросы не кэшируем, просто проксируем
  return;
});

// Сообщения из приложения
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    // Очищаем все старые кэши перед активацией
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== ASSETS_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.skipWaiting();
    });
  }
  
  if (event.data === 'CHECK_VERSION') {
    event.ports[0]?.postMessage({ 
      version: CACHE_NAME,
      static: STATIC_CACHE,
      assets: ASSETS_CACHE
    });
  }
  
  if (event.data === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      event.ports[0]?.postMessage({ cleared: true });
    });
  }
});
