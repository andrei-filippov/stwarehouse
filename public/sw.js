// Service Worker для оффлайн-режима
const CACHE_NAME = 'stwarehouse-v3';
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
      // Принудительно активируем новый SW
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
      // Берём контроль над страницами сразу
      return self.clients.claim();
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 1. API запросы к Supabase — пропускаем (не кэшируем)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Если нет сети, возвращаем ошибку с флагом queued
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
  
  // 2. Для статических ресурсов (JS, CSS, HTML, иконки) — Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'document' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.url.endsWith('.js') ||
    request.url.endsWith('.css') ||
    request.url.endsWith('.html') ||
    request.url.endsWith('.svg') ||
    request.url.endsWith('.png') ||
    request.url.endsWith('.json')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        // Возвращаем из кэша, если есть
        if (response) {
          return response;
        }
        
        // Иначе запрашиваем с сети и кэшируем
        return fetch(request).then((fetchResponse) => {
          if (fetchResponse && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return fetchResponse;
        }).catch(() => {
          // Если нет сети и нет в кэше — для HTML отдаём index.html (SPA fallback)
          if (request.destination === 'document' || request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          // Для остального — просто ошибка
          return new Response('Network error', { status: 408 });
        });
      })
    );
    return;
  }
  
  // 3. Для остальных запросов — Network First с fallback
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Сообщения из приложения (для skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data === 'CHECK_VERSION') {
    // Можно добавить проверку версии
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  }
});
