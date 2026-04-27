const CACHE_NAME = 'tramplin-pwa-v1';

self.addEventListener('install', (event) => {
    // Форсируем активацию нового Service Worker сразу
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Простейшая стратегия "Network First, fallback to Cache" 
    // Главная цель этого SW - удовлетворить требования браузеров для установки PWA (Installability).
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
