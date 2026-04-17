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

export default {
  auth: authApi,
  inventario: inventarioApi,
  ventas: ventasApi,
};
