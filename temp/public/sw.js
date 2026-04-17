const CACHE_NAME = 'apolodigital-v1';
const STATIC_CACHE = 'apolodigital-static-v1';
const DATA_CACHE = 'apolodigital-data-v1';

// Archivos que siempre deben estar en cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Rutas de API que se cachean
const API_ROUTES = [
  '/api/v1/productos',
  '/api/v1/categorias',
  '/api/v1/almacenes',
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Cacheando archivos estáticos');
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DATA_CACHE)
          .map((name) => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Peticiones a la API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Archivos estáticos
  event.respondWith(cacheFirstStrategy(request));
});

// Estrategia: Red primero, cache como fallback (para API)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Si es GET y fue exitoso, guardar en cache
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Red no disponible, buscando en cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si es POST (como crear venta), guardar para sincronizar después
    if (request.method === 'POST') {
      return new Response(
        JSON.stringify({ 
          offline: true, 
          message: 'Guardado para sincronizar' 
        }),
        { 
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

// Estrategia: Cache primero, red como fallback (para archivos estáticos)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Error al obtener:', request.url);
    
    // Página offline de fallback
    if (request.destination === 'document') {
      return caches.match('/');
    }
    
    throw error;
  }
}

// Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data.type === 'SYNC_PENDING') {
    console.log('[SW] Sincronizando ventas pendientes...');
    syncPendingSales();
  }
});

// Sincronización en background
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncPendingSales());
  }
});

async function syncPendingSales() {
  // Esta función será llamada por el cliente cuando se recupere la conexión
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_STARTED' });
  });
}
