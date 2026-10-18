/**
 * CAST Inspect — Service Worker (PWA Offline & Cache Engine)
 * Versão: cast-inspect-pwa-v2
 */

const CACHE_NAME = 'cast-inspect-cache-v2';

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
  '/icon-maskable.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

// Instalação: Precache da casca do aplicativo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
          console.warn('[PWA SW] Precache parcial:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: Limpeza de caches antigos e claim imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Requisições não-GET (POST, PUT, DELETE) não são interceptadas
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // IMPORTANTE: Apenas interceptar requisições HTTP/HTTPS da MESMA ORIGEM.
  // Ignorar completamente chamadas externas como Google Drive API, Firebase, Google Identity, etc.
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) {
    return;
  }

  // Ignorar módulos Vite e hot reload em ambiente de desenvolvimento
  if (url.pathname.includes('/@vite/') || url.pathname.includes('/@fs/') || url.pathname.includes('node_modules')) {
    return;
  }

  // 1. API: Rede primeiro (Network-First) com fallback para resposta offline se houver
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
          JSON.stringify({ offline: true, message: 'Operação offline ativa' }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      })
    );
    return;
  }

  // 2. Navegação de páginas HTML: Network-First com fallback para /index.html em cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // 3. Recursos estáticos (JS, CSS, Imagens, Fontes): Cache-First ou Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache em segundo plano (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Se não está no cache, busca na rede e salva no cache
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[PWA SW] Recurso indisponível offline:', request.url);
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
    })
  );
});
