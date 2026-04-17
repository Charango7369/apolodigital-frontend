import { syncService } from './services/syncService';

/**
 * Inicializa la PWA:
 * - Registra el Service Worker
 * - Precarga datos para uso offline
 * - Configura sincronización automática
 */
export async function initPWA() {
  // 1. Registrar Service Worker (solo en producción - evita problemas en dev)
  if ('serviceWorker' in navigator) {
    // En desarrollo (Vite dev server) es común desactivar el SW para evitar cache confuso
    const isDev = import.meta.env.DEV;

    if (!isDev) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[PWA] Service Worker registrado:', registration.scope);

        // Escuchar actualizaciones
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('[PWA] Nueva versión disponible');
              window.dispatchEvent(new CustomEvent('pwa:update-available'));
            }
          });
        });
      } catch (error) {
        console.error('[PWA] Error registrando Service Worker:', error);
      }
    } else {
      console.log('[PWA] SW deshabilitado en dev');
    }
  }

  // 2. Escuchar reconexión para sincronizar
  window.addEventListener('online', async () => {
    console.log('[PWA] Conexión restaurada');

    // Esperar un momento para que la red se estabilice
    setTimeout(async () => {
      const result = await syncService.syncAll();
      if (result.synced > 0) {
        showNotification(`${result.synced} ventas sincronizadas`);
      }
    }, 2000);
  });

  // 3. Solicitar permiso de notificaciones en primer click
  if ('Notification' in window && Notification.permission === 'default') {
    document.addEventListener(
      'click',
      () => {
        Notification.requestPermission();
      },
      { once: true }
    );
  }

  // 4. Precargar datos si hay conexión Y token (evita 401 en cold start)
  if (navigator.onLine && localStorage.getItem('token')) {
    try {
      await syncService.refreshLocalData();
      console.log('[PWA] Datos precargados para uso offline');
    } catch (error) {
      console.warn('[PWA] No se pudieron precargar datos:', error);
    }
  }
}

/**
 * Muestra una notificación del sistema
 */
function showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('ApoloDigital', {
      body: message,
      icon: '/icons/icon-192x192.png',
    });
  }
}

/**
 * Hook para detectar si la app se puede instalar
 */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa:installable'));
});

export function canInstallPWA() {
  return deferredPrompt !== null;
}

export async function installPWA() {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;

  return outcome === 'accepted';
}

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App instalada');
  deferredPrompt = null;
});
