import { offlineDB } from './offlineDB';

const API_URL = import.meta.env.VITE_API_URL || 'https://apolodigital-inventario-production.up.railway.app/api/v1';

// Helpers
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${response.status}`);
  }
  return response.json();
};

// Verificar si estamos online
const isOnline = () => navigator.onLine;

// ============ AUTH API ============
export const authApi = {
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    return handleResponse(response);
  },

  me: async () => {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ============ INVENTARIO API (con soporte offline) ============
export const inventarioApi = {
  // Productos
  getProductos: async (params = {}) => {
    if (!isOnline()) {
      console.log('[API] Offline - usando datos locales');
      const productos = await offlineDB.getProductos();
      return { items: productos, total: productos.length };
    }

    try {
      const queryParams = new URLSearchParams(params);
      const response = await fetch(`${API_URL}/productos?${queryParams}`, {
        headers: getHeaders(),
      });
      const data = await handleResponse(response);
      
      // La API devuelve { items: [...], total, page, per_page, pages }
      const productos = data.items || data || [];
      
      // Guardar en cache local
      await offlineDB.saveProductos(productos);
      
      return data;
    } catch (error) {
      // Si falla la red, intentar desde cache
      console.log('[API] Error de red, usando cache:', error.message);
      const cached = await offlineDB.getProductos();
      if (cached.length > 0) {
        return { items: cached, total: cached.length };
      }
      throw error;
    }
  },

  getProducto: async (id) => {
    const response = await fetch(`${API_URL}/productos/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  createProducto: async (data) => {
    const response = await fetch(`${API_URL}/productos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateProducto: async (id, data) => {
    const response = await fetch(`${API_URL}/productos/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteProducto: async (id) => {
    const response = await fetch(`${API_URL}/productos/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Error al eliminar');
    return true;
  },

  // Categorías
  getCategorias: async () => {
    if (!isOnline()) {
      return offlineDB.getCategorias();
    }

    try {
      const response = await fetch(`${API_URL}/categorias`, {
        headers: getHeaders(),
      });
      const categorias = await handleResponse(response);
      await offlineDB.saveCategorias(categorias);
      return categorias;
    } catch (error) {
      const cached = await offlineDB.getCategorias();
      if (cached.length > 0) return cached;
      throw error;
    }
  },

  createCategoria: async (data) => {
    const response = await fetch(`${API_URL}/categorias`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateCategoria: async (id, data) => {
    const response = await fetch(`${API_URL}/categorias/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteCategoria: async (id) => {
    const response = await fetch(`${API_URL}/categorias/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Error al eliminar');
    return true;
  },

  // Almacenes
  getAlmacenes: async () => {
    if (!isOnline()) {
      return offlineDB.getAlmacenes();
    }

    try {
      const response = await fetch(`${API_URL}/almacenes`, {
        headers: getHeaders(),
      });
      const almacenes = await handleResponse(response);
      await offlineDB.saveAlmacenes(almacenes);
      return almacenes;
    } catch (error) {
      const cached = await offlineDB.getAlmacenes();
      if (cached.length > 0) return cached;
      throw error;
    }
  },

  createAlmacen: async (data) => {
    const response = await fetch(`${API_URL}/almacenes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateAlmacen: async (id, data) => {
    const response = await fetch(`${API_URL}/almacenes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Stock
  getStock: async (varianteId) => {
    const response = await fetch(`${API_URL}/stock/variante/${varianteId}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getAlertasStock: async () => {
    const response = await fetch(`${API_URL}/stock/alertas`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Busca una variante por código de barras.
   *
   * Lógica de fallback:
   *  - Online y código existe → API + guardar en cache
   *  - Online y código NO existe → retorna null (NO busca offline, el dato es real)
   *  - Offline (error de red) → busca en IndexedDB
   *
   * @returns {Promise<object|null>} la variante o null si no se encontró
   */
  buscarPorBarcode: async (codigo) => {
    if (!codigo || codigo.trim() === '') return null;
    const codigoLimpio = codigo.trim();

    // Si estamos offline, ir directo al cache
    if (!isOnline()) {
      const cached = await offlineDB.getVariantePorBarcode(codigoLimpio);
      return cached || null;
    }

    try {
      const response = await fetch(
        `${API_URL}/variantes/barcode/${encodeURIComponent(codigoLimpio)}`,
        { headers: getHeaders() }
      );

      if (response.status === 404) {
        // El código no existe en el backend → dato autoritativo, no buscar offline
        return null;
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = await response.json();
      // Guardar en cache para uso offline futuro
      await offlineDB.saveVarianteBarcode(data);
      return data;
    } catch (error) {
      // Error de red → intentar cache local
      console.warn('[API] Error de red buscando barcode, probando cache:', error.message);
      const cached = await offlineDB.getVariantePorBarcode(codigoLimpio);
      return cached || null;
    }
  },

  // ============ PROVEEDORES ============
  getProveedores: async (soloActivos = true) => {
    const response = await fetch(
      `${API_URL}/proveedores?solo_activos=${soloActivos}`,
      { headers: getHeaders() }
    );
    return handleResponse(response);
  },

  createProveedor: async (data) => {
    const response = await fetch(`${API_URL}/proveedores`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateProveedor: async (id, data) => {
    const response = await fetch(`${API_URL}/proveedores/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
// ============ LOTES ============
  crearLote: async (data) => {
    const response = await fetch(`${API_URL}/lotes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  getLotes: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`${API_URL}/lotes?${queryParams}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
  // ============ LOTES ============
  crearMovimiento: async (data) => {
    const response = await fetch(`${API_URL}/movimientos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getMovimientos: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`${API_URL}/movimientos?${queryParams}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

// ============ VENTAS API (con soporte offline) ============
export const ventasApi = {
  // Crear venta (con fallback offline)
  createVenta: async (data) => {
    // Calcular total desde detalles
    const detalles = data.detalles || [];
    const total = detalles.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    if (!isOnline()) {
      console.log('[API] Offline - guardando venta localmente');
      const ventaOffline = await offlineDB.saveVentaPendiente(data);
      return {
        ...ventaOffline,
        offline: true,
        numero: `OFF-${ventaOffline.temp_id}`,
        estado: 'COMPLETADA',
        total: total,
      };
    }

    try {
      const response = await fetch(`${API_URL}/ventas`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    } catch (error) {
      // Si falla, guardar offline
      console.log('[API] Error de red, guardando offline:', error.message);
      const ventaOffline = await offlineDB.saveVentaPendiente(data);
      return {
        ...ventaOffline,
        offline: true,
        numero: `OFF-${ventaOffline.temp_id}`,
        estado: 'COMPLETADA',
        total: total,
      };
    }
  },

  completarVenta: async (id, metodoPago = 'EFECTIVO', montoRecibido = null) => {
    if (String(id).startsWith('OFF-')) {
      return { success: true, offline: true };
    }

    const response = await fetch(`${API_URL}/ventas/${id}/completar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
      metodo_pago: metodoPago,
      monto_recibido: montoRecibido
      })
    });
      return handleResponse(response);
  },

  getVentas: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`${API_URL}/ventas?${queryParams}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getVenta: async (id) => {
    const response = await fetch(`${API_URL}/ventas/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  cancelarVenta: async (id, motivo = '') => {
    const response = await fetch(`${API_URL}/ventas/${id}/cancelar`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ motivo }),
    });
    return handleResponse(response);
  },

  // Clientes
  getClientes: async () => {
    const response = await fetch(`${API_URL}/clientes`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  buscarClientePorTelefono: async (telefono) => {
    const response = await fetch(`${API_URL}/clientes/telefono/${telefono}`, {
      headers: getHeaders(),
    });
    if (response.status === 404) return null;
    return handleResponse(response);
  },

  // Reportes
  getResumenDia: async (fecha) => {
    const params = fecha ? `?fecha=${fecha}` : '';
    const response = await fetch(`${API_URL}/reportes/ventas-dia${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getResumenCaja: async (fecha) => {
    const params = fecha ? `?fecha=${fecha}` : '';
    const response = await fetch(`${API_URL}/reportes/caja${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getReporteCaja: async (fecha) => {
    const params = fecha ? `?fecha=${fecha}` : '';
    const response = await fetch(`${API_URL}/reportes/caja${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getReporteVentasDia: async (fecha) => {
    const params = fecha ? `?fecha=${fecha}` : '';
    const response = await fetch(`${API_URL}/reportes/ventas-dia${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Obtener ventas pendientes offline
  getVentasPendientes: async () => {
    return offlineDB.getVentasPendientes();
  },
};

// ============ ADMIN API (panel SUPERADMIN) ============
export const adminApi = {
  getNegocios: async (soloActivos = false) => {
    const response = await fetch(
      `${API_URL}/admin/negocios?solo_activos=${soloActivos}`,
      { headers: getHeaders() }
    );
    return handleResponse(response);
  },

  getNegocio: async (id) => {
    const response = await fetch(`${API_URL}/admin/negocios/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  createNegocio: async (data) => {
    const response = await fetch(`${API_URL}/admin/negocios`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateNegocio: async (id, data) => {
    const response = await fetch(`${API_URL}/admin/negocios/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  toggleNegocio: async (id) => {
    const response = await fetch(`${API_URL}/admin/negocios/${id}/toggle`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

export default {
  auth: authApi,
  inventario: inventarioApi,
  ventas: ventasApi,
  admin: adminApi,
};
