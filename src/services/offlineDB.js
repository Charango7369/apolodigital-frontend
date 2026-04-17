/**
 * Servicio de base de datos local con IndexedDB
 * Almacena productos, categorías y ventas pendientes offline
 */

const DB_NAME = 'apolodigital-offline';
const DB_VERSION = 1;

class OfflineDB {
  constructor() {
    this.db = null;
    this.isReady = false;
  }

  async init() {
    if (this.isReady) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineDB] Error al abrir la base de datos');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('[OfflineDB] Base de datos lista');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para productos
        if (!db.objectStoreNames.contains('productos')) {
          const productosStore = db.createObjectStore('productos', { keyPath: 'id' });
          productosStore.createIndex('nombre', 'nombre', { unique: false });
          productosStore.createIndex('categoria_id', 'categoria_id', { unique: false });
        }

        // Store para categorías
        if (!db.objectStoreNames.contains('categorias')) {
          db.createObjectStore('categorias', { keyPath: 'id' });
        }

        // Store para almacenes
        if (!db.objectStoreNames.contains('almacenes')) {
          db.createObjectStore('almacenes', { keyPath: 'id' });
        }

        // Store para ventas pendientes (offline)
        if (!db.objectStoreNames.contains('ventas_pendientes')) {
          const ventasStore = db.createObjectStore('ventas_pendientes', { 
            keyPath: 'temp_id', 
            autoIncrement: true 
          });
          ventasStore.createIndex('created_at', 'created_at', { unique: false });
          ventasStore.createIndex('synced', 'synced', { unique: false });
        }

        // Store para configuración del negocio
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }

        console.log('[OfflineDB] Estructura creada');
      };
    });
  }

  // ========== PRODUCTOS ==========
  async saveProductos(productos) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('productos', 'readwrite');
      const store = tx.objectStore('productos');
      
      store.clear();
      for (const producto of productos) {
        store.put(producto);
      }
      
      tx.oncomplete = () => {
        console.log(`[OfflineDB] ${productos.length} productos guardados`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getProductos() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('productos', 'readonly');
      const store = tx.objectStore('productos');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getProducto(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('productos', 'readonly');
      const store = tx.objectStore('productos');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== CATEGORÍAS ==========
  async saveCategorias(categorias) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('categorias', 'readwrite');
      const store = tx.objectStore('categorias');
      
      store.clear();
      for (const cat of categorias) {
        store.put(cat);
      }
      
      tx.oncomplete = () => {
        console.log(`[OfflineDB] ${categorias.length} categorías guardadas`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCategorias() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('categorias', 'readonly');
      const store = tx.objectStore('categorias');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== ALMACENES ==========
  async saveAlmacenes(almacenes) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('almacenes', 'readwrite');
      const store = tx.objectStore('almacenes');
      
      store.clear();
      for (const alm of almacenes) {
        store.put(alm);
      }
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAlmacenes() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('almacenes', 'readonly');
      const store = tx.objectStore('almacenes');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== VENTAS PENDIENTES ==========
  async saveVentaPendiente(venta) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('ventas_pendientes', 'readwrite');
      const store = tx.objectStore('ventas_pendientes');
      
      const ventaOffline = {
        ...venta,
        created_at: new Date().toISOString(),
        synced: false,
      };
      
      const request = store.add(ventaOffline);
      
      request.onsuccess = () => {
        console.log('[OfflineDB] Venta guardada offline:', request.result);
        resolve({ ...ventaOffline, temp_id: request.result });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getVentasPendientes() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('ventas_pendientes', 'readonly');
      const store = tx.objectStore('ventas_pendientes');
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Filtrar solo las no sincronizadas
        const pendientes = (request.result || []).filter(v => v.synced === false);
        resolve(pendientes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async marcarVentaSincronizada(tempId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('ventas_pendientes', 'readwrite');
      const store = tx.objectStore('ventas_pendientes');
      const request = store.get(tempId);
      
      request.onsuccess = () => {
        const venta = request.result;
        if (venta) {
          venta.synced = true;
          store.put(venta);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async eliminarVentasPendientesSincronizadas() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('ventas_pendientes', 'readwrite');
      const store = tx.objectStore('ventas_pendientes');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const ventas = request.result || [];
        for (const venta of ventas) {
          if (venta.synced === true) {
            store.delete(venta.temp_id);
          }
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ========== CONFIGURACIÓN ==========
  async saveConfig(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      const request = store.put({ key, value, updated_at: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConfig(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('config', 'readonly');
      const store = tx.objectStore('config');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== SINCRONIZACIÓN ==========
  async getLastSync() {
    return this.getConfig('last_sync');
  }

  async setLastSync() {
    return this.saveConfig('last_sync', new Date().toISOString());
  }
}

export const offlineDB = new OfflineDB();
