import { useState, useEffect } from 'react';

/**
 * Hook para detectar si hay conexión a internet
 * Retorna: { isOnline, wasOffline }
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Disparar evento de reconexión
        window.dispatchEvent(new CustomEvent('app:reconnected'));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

/**
 * Componente banner que muestra estado de conexión
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Escuchar cambios en ventas pendientes
    const checkPending = async () => {
      try {
        const { offlineDB } = await import('./offlineDB');
        const pending = await offlineDB.getVentasPendientes();
        setPendingCount(pending.length);
      } catch (e) {
        console.error('Error checking pending sales:', e);
      }
    };

    checkPending();
    
    // Revisar cada 10 segundos
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Cuando vuelve la conexión, sincronizar
    const handleReconnected = async () => {
      if (pendingCount > 0) {
        setSyncing(true);
        try {
          const { syncService } = await import('./syncService');
          await syncService.syncAll();
          setPendingCount(0);
        } catch (e) {
          console.error('Error syncing:', e);
        } finally {
          setSyncing(false);
        }
      }
    };

    window.addEventListener('app:reconnected', handleReconnected);
    return () => window.removeEventListener('app:reconnected', handleReconnected);
  }, [pendingCount]);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-lg shadow-lg z-50 ${
      isOnline ? 'bg-yellow-500' : 'bg-red-500'
    } text-white`}>
      {!isOnline ? (
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <div>
            <p className="font-semibold">Sin conexión</p>
            <p className="text-sm opacity-90">
              Las ventas se guardarán localmente
            </p>
          </div>
        </div>
      ) : syncing ? (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="font-semibold">Sincronizando...</p>
            <p className="text-sm opacity-90">{pendingCount} ventas pendientes</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-white rounded-full" />
          <div>
            <p className="font-semibold">Conexión restaurada</p>
            <p className="text-sm opacity-90">{pendingCount} ventas por sincronizar</p>
          </div>
        </div>
      )}
    </div>
  );
}
