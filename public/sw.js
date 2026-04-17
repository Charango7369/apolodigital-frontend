// ApoloDigital — Service Worker
// Filosofía: este SW solo maneja el SHELL (HTML, JS, CSS, iconos).
// Los datos de la API se manejan en IndexedDB via offlineDB.js — no aquí.
// Las peticiones a api.apolodigital.lat / Railway son cross-origin y no las tocamos.

const SW_VERSION = 'v2';
const STATIC_CACHE = `apolodigital-static-${SW_VERSION}`;
const RUNTIME_CACHE = `apolodigital-runtime-${SW_VERSION}`;

// Archivos mínimos del shell que se precachean
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Instalando...`);
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precacheando shell');
        // addAll falla si uno falla. Usamos put individual para ser tolerantes.
        return Promise.all(
          SHELL_FILES.map((url) =>
            fetch(url, { cache: 'reload' })
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              })
              .catch((err) => console.warn(`[SW] No se pudo precachear ${url}:`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activando...`);
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Eliminando cache viejo:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Solo interceptamos GETs same-origin. Todo lo demás (POST, API cross-origin) pasa directo.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // 2. Navegaciones (HTML): network-first, fallback a index.html cacheado
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Actualizar cache del index
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // 3. Assets (JS, CSS, iconos, imágenes): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // si red falla, devuelve el cacheado

  // Devolver el cacheado inmediatamente si existe, sino esperar a la red
  return cached || fetchPromise;
}

// ============ MENSAJES ============
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
