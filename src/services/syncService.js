import { offlineDB } from './offlineDB';
import { inventarioApi, ventasApi } from './api';

/**
 * Servicio de sincronización de datos offline/online
 */
class SyncService {
  constructor() {
    this.isSyncing = false;
    this.listeners = [];
    this._isListeningGlobal = false;
    this._onlineHandler = null;
    this._offlineHandler = null;
    this._onlineDebounceTimer = null; // Debounce del evento 'online' ante wifi inestable
    this._authErrorNotified = false; // Latch anti-spam para el error 401
    this.lastSyncResult = null; // Último resultado de syncAll(), consultable por cualquier listener
    this.queryClient = null; // Inyectado desde main.jsx vía setQueryClient()
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
   * Inyecta la instancia de QueryClient de React Query. Necesario porque
   * syncService es un singleton fuera del árbol de React — no puede usar
   * el hook useQueryClient() como hace POS.jsx. Se llama UNA vez desde
   * main.jsx, apenas se crea el QueryClient.
   */
  setQueryClient(queryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Invalida los mismos reportes que POS.jsx invalida tras una venta online.
   * Se llama solo cuando syncPendingSalesInternal confirma que al menos una
   * venta se sincronizó de verdad contra el backend (no en abortos por 401,
   * ni si la cola estaba vacía).
   */
  _invalidarReportes() {
    if (!this.queryClient) return; // aún no inyectado (boot temprano, o tests)
    this.queryClient.invalidateQueries({ queryKey: ['stockActual'] });
    this.queryClient.invalidateQueries({ queryKey: ['alertasStock'] });
    this.queryClient.invalidateQueries({ queryKey: ['utilidadPeriodo'] });
    this.queryClient.invalidateQueries({ queryKey: ['utilidadProductos'] });
  }

  /**
   * Punto de entrada único: Sincroniza ventas y refresca catálogos de forma secuencial.
   * catalogOk en el retorno puede ser:
   *   - true  -> el catálogo se descargó y guardó correctamente
   *   - false -> se intentó descargar el catálogo y falló
   *   - null  -> el catálogo NUNCA se intentó descargar (abortado por 401 u offline)
   * No tratar `null` como "todo bien": significa "no evaluado".
   */
  async syncAll() {
    if (this.isSyncing) {
      return {
        synced: 0,
        failed: 0,
        conflicts: 0,
        catalogOk: null,
        abortedByAuth: false,
        skipped: true,
      };
    }

    this.isSyncing = true;
    this.notifyListeners('syncing');

    let salesResult = { synced: 0, failed: 0, conflicts: 0, abortedByAuth: false };
    let catalogOk = null; // null = no evaluado todavía

    try {
      // 1. Procesar cola de ventas en IndexedDB
      salesResult = await this.syncPendingSalesInternal();

      // 2. Solo intentar catálogo si no abortamos por sesión vencida y seguimos online
      if (!salesResult.abortedByAuth && navigator.onLine) {
        catalogOk = await this.refreshLocalDataInternal();
      }
    } catch (error) {
      console.error('[Sync] Falla crítica en el flujo de sincronización global:', error);
    } finally {
      this.isSyncing = false;

      this.lastSyncResult = { ...salesResult, catalogOk, skipped: false };

      // Ventas sincronizadas en segundo plano también deben invalidar los
      // reportes cacheados por React Query — no solo las que pasan por el
      // botón "Cobrar" de POS.jsx.
      if (salesResult.synced > 0) {
        this._invalidarReportes();
      }

      if (salesResult.abortedByAuth) {
        // La UI se entera vía el evento 'unauthorized', no hace falta duplicar aviso
        this.notifyListeners('idle');
      } else if (catalogOk === false) {
        // Solo disparamos 'catalog-error' si REALMENTE se intentó y falló (no si quedó en null)
        this.notifyListeners('catalog-error');
      } else {
        this.notifyListeners(salesResult.synced > 0 ? 'synced' : 'idle');
      }
    }

    return this.lastSyncResult;
  }

  /**
   * MANTENIMIENTO DE API PÚBLICA (compatibilidad con componentes legados)
   *
   * LEGACY: este wrapper emite 'idle' incondicionalmente en su finally, sin importar
   * el resultado real (éxito, fallo, o conflictos). Se preserva así a propósito para
   * no romper componentes viejos que ya dependen de ese comportamiento. Para lógica
   * nueva, usar syncAll() en vez de este método directamente.
   */
  async syncPendingSales() {
    if (this.isSyncing) {
      return { synced: 0, failed: 0, conflicts: 0, abortedByAuth: false, skipped: true };
    }
    this.isSyncing = true;
    this.notifyListeners('syncing');
    try {
      return await this.syncPendingSalesInternal();
    } finally {
      this.isSyncing = false;
      this.notifyListeners('idle'); // LEGACY: ver docstring del método
    }
  }

  /**
   * LEGACY (migrado): antes devolvía un boolean plano. Ahora devuelve { ok, skipped }
   * para ser consistente con syncAll()/syncPendingSales() y poder distinguir
   * "se saltó por sync en curso" de "se intentó y falló".
   *
   * BREAKING CHANGE: cualquier caller que haga `if (await refreshLocalData())`
   * hay que actualizarlo a `if ((await refreshLocalData()).ok)`.
   * Confirmado por grep (03/07): initPWA.js:70 no evalúa el retorno, no requiere cambios.
   */
  async refreshLocalData() {
    if (this.isSyncing) {
      return { ok: false, skipped: true };
    }
    this.isSyncing = true;
    this.notifyListeners('syncing');
    try {
      const ok = await this.refreshLocalDataInternal();
      return { ok, skipped: false };
    } finally {
      this.isSyncing = false;
      this.notifyListeners('idle'); // LEGACY: ver docstring del método
    }
  }

  /**
   * LÓGICA INTERNA: Procesamiento secuencial de la cola de ventas
   */
  async syncPendingSalesInternal() {
    if (!navigator.onLine) return { synced: 0, failed: 0, conflicts: 0, abortedByAuth: false };

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[Sync] Operación cancelada de forma prematura: Token ausente.');
      return { synced: 0, failed: 0, conflicts: 0, abortedByAuth: false };
    }

    let synced = 0;
    let conflicts = 0;
    let abortedByAuth = false;

    const API_URL = import.meta.env.VITE_API_URL;
    let pendientes = [];

    try {
      pendientes = await offlineDB.getVentasPendientes();
      console.log(`[Sync] Detectadas ${pendientes.length} transacciones en espera.`);

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

          if (response.status === 401) {
            console.error('[Sync] Código 401 detectado: Abortando bucle para evitar rechazos masivos.');
            abortedByAuth = true;

            if (!this._authErrorNotified) {
              this.notifyListeners('unauthorized');
              this._authErrorNotified = true; // Bloquear spam ante parpadeos de red
            }
            break;
          }

          if (response.ok) {
            // Si el servidor responde correctamente, el token vuelve a ser válido
            this._authErrorNotified = false;
            const ventaCreada = await response.json();
            await offlineDB.marcarVentaSincronizada(venta.temp_id);
            synced++;
            console.log(`[Sync] Venta ${venta.temp_id} persistida bajo ID: ${ventaCreada.id}`);
          } else {
            if (response.status >= 400 && response.status < 500) {
              const errorBody = await response.text();
              console.error(`[Sync] Regla de negocio rota en venta ${venta.temp_id}. Status: ${response.status}`);
              await offlineDB.marcarVentaConConflicto(venta.temp_id, errorBody);
              conflicts++;
            } else {
              console.warn(`[Sync] Servidor inestable (${response.status}) para la venta ${venta.temp_id}. Conservando en cola.`);
            }
          }
        } catch (error) {
          console.error(`[Sync] Error en la capa de transporte físico para venta ${venta.temp_id}:`, error);
        }
      }

      await offlineDB.eliminarVentasPendientesSincronizadas();
    } catch (error) {
      console.error('[Sync] Error crítico leyendo almacenamiento IndexedDB:', error);
    }

    // Deducción exacta y limpia, sin sumas parche a mitad del loop
    const failed = pendientes.length - synced - conflicts;

    return { synced, failed, conflicts, abortedByAuth };
  }

  /**
   * LÓGICA INTERNA: Hidratación local de catálogos
   */
  async refreshLocalDataInternal() {
    if (!navigator.onLine) return false;

    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      console.log('[Sync] Descargando catálogos maestros desde el servidor...');

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
      console.log('[Sync] Escritura de catálogos en IndexedDB finalizada con éxito.');
      return true;
    } catch (error) {
      console.error('[Sync] Error crítico descargando actualizaciones de inventario:', error);
      return false;
    }
  }

  /**
   * Único punto de escucha de 'online'/'offline' en toda la app.
   * Se llama UNA vez desde initPWA() al boot y vive toda la sesión (nunca
   * stopListening() en producción). Cualquier componente debe usar
   * addListener() para reaccionar a cambios de estado, sin tocar este ciclo
   * de vida.
   */
  startListening() {
    if (this._isListeningGlobal) return;

    this._onlineHandler = () => {
      console.log('[Sync] Evento de restauración de red capturado, esperando estabilización...');

      // Debounce: si la red parpadea (varios 'online' seguidos), reiniciamos el timer
      // en cada evento en vez de disparar un syncAll() por cada parpadeo.
      if (this._onlineDebounceTimer) {
        clearTimeout(this._onlineDebounceTimer);
      }
      this._onlineDebounceTimer = setTimeout(async () => {
        this._onlineDebounceTimer = null;
        await this.syncAll();
      }, 2000);
    };

    this._offlineHandler = () => {
      console.log('[Sync] Evento de pérdida de red capturado.');
      if (this._onlineDebounceTimer) {
        clearTimeout(this._onlineDebounceTimer);
        this._onlineDebounceTimer = null;
      }
      this.notifyListeners('offline');
    };

    window.addEventListener('online', this._onlineHandler);
    window.addEventListener('offline', this._offlineHandler);

    this._isListeningGlobal = true;
  }

  stopListening() {
    if (!this._isListeningGlobal) return;

    window.removeEventListener('online', this._onlineHandler);
    window.removeEventListener('offline', this._offlineHandler);

    if (this._onlineDebounceTimer) {
      clearTimeout(this._onlineDebounceTimer);
      this._onlineDebounceTimer = null;
    }

    this._isListeningGlobal = false;
  }
}

export const syncService = new SyncService();
