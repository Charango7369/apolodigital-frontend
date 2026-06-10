// ApoloDigital — Service Worker
// Este SW solo maneja el SHELL: HTML, JS, CSS, manifest, iconos e imágenes.
// Las búsquedas, compras, ventas y datos dinámicos NO se cachean aquí.

const SW_VERSION = 'v3';
const STATIC_CACHE = `apolodigital-static-${SW_VERSION}`;
const RUNTIME_CACHE = `apolodigital-runtime-${SW_VERSION}`;

const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Instalando...`);

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL_FILES.map((url) =>
            fetch(url, { cache: 'reload' })
              .then((res) => {
                if (res.ok) return cache.put(url, res.clone());
              })
              .catch((err) => console.warn(`[SW] No se pudo precachear ${url}:`, err))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Nunca interceptar datos dinámicos, búsquedas o API.
  if (debePasarDirecto(url, request)) {
    return;
  }

  // Navegaciones del frontend: intenta red, si no hay red usa index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          }

          return response;
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then((r) => r || caches.match('/'))
            .then(
              (r) =>
                r ||
                new Response('Offline', {
                  status: 503,
                  headers: { 'Content-Type': 'text/html' },
                })
            )
        )
    );

    return;
  }

  // Solo cachear assets reales del frontend.
  if (esAssetEstatico(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function debePasarDirecto(url, request) {
  const path = url.pathname;

  if (path.startsWith('/api/')) return true;
  if (path.startsWith('/productos')) return true;
  if (path.startsWith('/variantes')) return true;
  if (path.startsWith('/compras')) return true;
  if (path.startsWith('/ventas')) return true;
  if (path.startsWith('/stock')) return true;
  if (path.startsWith('/inventario')) return true;

  // Las búsquedas suelen venir como ?q=, ?search=, ?buscar=, etc.
  // No deben cachearse porque cambian mientras el usuario escribe.
  if (url.search && request.mode !== 'navigate') return true;

  return false;
}

function esAssetEstatico(request) {
  return [
    'script',
    'style',
    'image',
    'font',
    'manifest',
  ].includes(request.destination);
}

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
    .catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});