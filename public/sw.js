// Service Worker для оффлайн-режима
const CACHE_NAME = 'stwarehouse-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico'
];

// При установке кэшируем статические ресурсы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
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
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Проверяем, является ли запрос навигационным (для SPA)
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && 
          request.headers.get('accept')?.includes('text/html'));
}

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 1. API запросы к Supabase — пропускаем (не кэшируем)
  if (url.hostname.includes('supabase.co')) {
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
  
  // 2. Навигационные запросы (HTML страницы) — всегда отдаём index.html для SPA
  if (isNavigationRequest(request)) {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Если есть в кэше — отдаём, иначе запрашиваем с сети
        if (cached) {
          // Параллельно обновляем кэш
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put('/index.html', response);
              });
            }
          }).catch(() => {});
          return cached;
        }
        
        // Нет в кэше — пробуем сеть
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return response;
        }).catch(() => {
          return new Response('Network error - app not cached', { status: 408 });
        });
      })
    );
    return;
  }
  
  // 3. Статические ресурсы Vite (JS/CSS с hash) — Cache First с ограниченным временем жизни
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request).then((fetchResponse) => {
          if (fetchResponse && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return fetchResponse;
        }).catch(() => {
          return new Response('Resource not available offline', { status: 408 });
        });
      })
    );
    return;
  }
  
  // 4. Остальные запросы — Network First
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Сообщения из приложения
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data === 'CHECK_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  }
});
