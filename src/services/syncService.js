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

  // Agregar listener para cambios de estado
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach(l => l(status));
  }

  // Sincronizar ventas pendientes al servidor
  async syncPendingSales() {
    if (this.isSyncing || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners('syncing');

    let synced = 0;
    let failed = 0;

    try {
      const pendientes = await offlineDB.getVentasPendientes();
      console.log(`[Sync] ${pendientes.length} ventas pendientes`);

      for (const venta of pendientes) {
        try {
          // Enviar al servidor
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'https://apolodigital-inventario-production.up.railway.app/api/v1'}/ventas`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({
                almacen_id: venta.almacen_id,
                detalles: venta.detalles,
                metodo_pago: venta.metodo_pago,
                cliente_nombre: venta.cliente_nombre,
                cliente_nit: venta.cliente_nit,
                notas: venta.notas || '',
              }),
            }
          );

          if (response.ok) {
            const ventaCreada = await response.json();
            // Completar la venta
            await fetch(
              `${import.meta.env.VITE_API_URL || 'https://apolodigital-inventario-production.up.railway.app/api/v1'}/ventas/${ventaCreada.id}/completar`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
              }
            );
            await offlineDB.marcarVentaSincronizada(venta.temp_id);
            synced++;
            console.log(`[Sync] Venta ${venta.temp_id} sincronizada`);
          } else {
            failed++;
            console.error(`[Sync] Error al sincronizar venta ${venta.temp_id}`);
          }
        } catch (error) {
          failed++;
          console.error(`[Sync] Error:`, error);
        }
      }

      // Limpiar ventas sincronizadas
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

    try {
      console.log('[Sync] Actualizando datos locales...');

      // Obtener productos
      const productosData = await inventarioApi.getProductos();
      const productos = productosData.items || productosData || [];
      if (Array.isArray(productos)) {
        await offlineDB.saveProductos(productos);
      }

      // Obtener categorías
      const categorias = await inventarioApi.getCategorias();
      if (Array.isArray(categorias)) {
        await offlineDB.saveCategorias(categorias);
      }

      // Obtener almacenes
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
      await this.syncPendingSales();
      await this.refreshLocalData();
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Sin conexión - modo offline activado');
      this.notifyListeners('offline');
    });
  }
}

export const syncService = new SyncService();
