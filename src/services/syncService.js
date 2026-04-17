import { offlineDB } from './offlineDB';
import { inventarioApi, ventasApi } from './api';

/**
 * Servicio de sincronización de datos offline/online
 */
class SyncService {
  constructor() {
    this.isSyncing = false;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach((l) => l(status));
  }

  /**
   * Punto de entrada único: sincroniza ventas pendientes + refresca datos locales.
   * Es el método que deben llamar initPWA, OfflineBanner y cualquier listener de 'online'.
   */
  async syncAll() {
    const result = await this.syncPendingSales();
    if (navigator.onLine) {
      await this.refreshLocalData();
    }
    return result;
  }

  // Sincronizar ventas pendientes al servidor
  async syncPendingSales() {
    if (this.isSyncing || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[Sync] Sin token, no se puede sincronizar');
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners('syncing');

    let synced = 0;
    let failed = 0;

    const API_URL =
      import.meta.env.VITE_API_URL ||
      'https://apolodigital-inventario-production.up.railway.app/api/v1';

    try {
      const pendientes = await offlineDB.getVentasPendientes();
      console.log(`[Sync] ${pendientes.length} ventas pendientes`);

      for (const venta of pendientes) {
        try {
          const response = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              almacen_id: venta.almacen_id,
              detalles: venta.detalles,
              metodo_pago: venta.metodo_pago,
              cliente_nombre: venta.cliente_nombre,
              cliente_nit: venta.cliente_nit,
              notas: venta.notas || '',
            }),
          });

          if (response.ok) {
            const ventaCreada = await response.json();
            await fetch(`${API_URL}/ventas/${ventaCreada.id}/completar`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                metodo_pago: venta.metodo_pago,
                monto_recibido: venta.monto_recibido || null,
              }),
            });
            await offlineDB.marcarVentaSincronizada(venta.temp_id);
            synced++;
            console.log(`[Sync] Venta ${venta.temp_id} sincronizada`);
          } else {
            failed++;
            console.error(
              `[Sync] Error al sincronizar venta ${venta.temp_id}:`,
              response.status
            );
          }
        } catch (error) {
          failed++;
          console.error(`[Sync] Error red en venta ${venta.temp_id}:`, error);
        }
      }

      await offlineDB.eliminarVentasPendientesSincronizadas();
    } catch (error) {
      console.error('[Sync] Error general:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners(synced > 0 ? 'synced' : 'idle');
    }

    return { synced, failed };
  }

  // Actualizar datos locales desde el servidor
  async refreshLocalData() {
    if (!navigator.onLine) {
      console.log('[Sync] Sin conexión, usando cache local');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[Sync] Sin token, se omite refresh');
      return;
    }

    try {
      console.log('[Sync] Actualizando datos locales...');

      const productosData = await inventarioApi.getProductos();
      const productos = productosData.items || productosData || [];
      if (Array.isArray(productos)) {
        await offlineDB.saveProductos(productos);
      }

      const categorias = await inventarioApi.getCategorias();
      if (Array.isArray(categorias)) {
        await offlineDB.saveCategorias(categorias);
      }

      const almacenes = await inventarioApi.getAlmacenes();
      if (Array.isArray(almacenes)) {
        await offlineDB.saveAlmacenes(almacenes);
      }

      await offlineDB.setLastSync();
      console.log('[Sync] Datos locales actualizados');
    } catch (error) {
      console.error('[Sync] Error actualizando datos locales:', error);
    }
  }

  // Iniciar escucha de cambios de conexión
  startListening() {
    window.addEventListener('online', async () => {
      console.log('[Sync] Conexión restaurada');
      await this.syncAll();
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Sin conexión - modo offline activado');
      this.notifyListeners('offline');
    });
  }
}

export const syncService = new SyncService();
