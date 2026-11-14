import { offlineDB } from './offlineDB';

const API_URL = import.meta.env.VITE_API_URL;

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
      
      const productos = data.items || data || [];
      await offlineDB.saveProductos(productos);
      
      return data;
    } catch (error) {
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

  getStockActual: async (filtros = {}) => {
    const queryParams = new URLSearchParams(filtros).toString();
    const url = queryParams 
      ? `${API_URL}/reportes/stock-actual?${queryParams}` 
      : `${API_URL}/reportes/stock-actual`;
      
    const response = await fetch(url, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  buscarPorBarcode: async (codigo) => {
    if (!codigo || codigo.trim() === '') return null;
    const codigoLimpio = codigo.trim();

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
        return null;
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = await response.json();
      await offlineDB.saveVarianteBarcode(data);
      return data;
    } catch (error) {
      console.warn('[API] Error de red buscando barcode, probando cache:', error.message);
      const cached = await offlineDB.getVariantePorBarcode(codigoLimpio);
      return cached || null;
    }
  },

  // Proveedores
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

  // Lotes
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
  
  getLotesProximosVencer: async (dias = 180) => {
    const response = await fetch(`${API_URL}/lotes/proximos-vencer?dias=${dias}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Movimientos
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
}; // <--- CIERRE CORRECTO DEL OBJETO inventarioApi

// ============ VENTAS API (con soporte offline e idempotencia) ============
export const ventasApi = {
  createVenta: async (data, customIdempKey = null) => {
    const detalles = data.detalles || [];
    const total = detalles.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    const idempotencyKey = customIdempKey || data.idempotency_key || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    );

    const payload = {
      ...data,
      idempotency_key: idempotencyKey,
    };

    if (!isOnline()) {
      console.log('[API] Offline - guardando venta localmente con clave:', idempotencyKey);
      const ventaOffline = await offlineDB.saveVentaPendiente(payload);
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
        headers: {
          ...getHeaders(),
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    } catch (error) {
      console.log('[API] Error de red, guardando offline:', error.message);
      const ventaOffline = await offlineDB.saveVentaPendiente(payload);
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

  getVentaPorNumero: async (numero) => {
    const response = await fetch(`${API_URL}/ventas/numero/${numero}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  cancelarVenta: async (id, data = {}, customIdempKey = null) => {
    const motivo = typeof data === 'string' ? data : (data.motivo || 'Cancelación de venta');
    const devolverEfectivo = typeof data === 'object' && data.devolver_efectivo !== undefined ? data.devolver_efectivo : false;

    const idempotencyKey = customIdempKey || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-canc-${Date.now()}`
    );

    const response = await fetch(`${API_URL}/ventas/${id}/cancelar`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        motivo,
        devolver_efectivo: devolverEfectivo,
      }),
    });
    return handleResponse(response);
  },

  getAuditoriaCancelacion: async (id) => {
    const response = await fetch(`${API_URL}/ventas/${id}/auditoria-cancelacion`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getHistorialPagos: async (ventaId) => {
    const response = await fetch(`${API_URL}/ventas/${ventaId}/historial`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  registrarPagoVenta: async (ventaId, data, customIdempKey = null) => {
    const idempotencyKey = customIdempKey || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-pago-${Date.now()}`
    );

    const response = await fetch(`${API_URL}/ventas/${ventaId}/pagos`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getClientes: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    const url = Object.keys(params).length > 0 ? `${API_URL}/clientes?${queryParams}` : `${API_URL}/clientes`;
    const response = await fetch(url, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  buscarClientePorTelefono: async (telefono) => {
    const response = await fetch(`${API_URL}/clientes/telefono/${encodeURIComponent(telefono)}`, {
      headers: getHeaders(),
    });
    if (response.status === 404) return null;
    return handleResponse(response);
  },

  crearCliente: async (data) => {
    const response = await fetch(`${API_URL}/clientes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  actualizarCliente: async (id, data) => {
    const response = await fetch(`${API_URL}/clientes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

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

  getVentasPendientes: async () => {
    return offlineDB.getVentasPendientes();
  },
};

// ============ PAGOS API (Ciclo de Vida Financiero) ============
export const pagosApi = {
  confirmarPago: async (pagoId, data = {}, customIdempKey = null) => {
    const idempotencyKey = customIdempKey || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-conf-${Date.now()}`
    );

    const response = await fetch(`${API_URL}/ventas/pagos/${pagoId}/confirmar`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  marcarPagoFallido: async (pagoId, motivo) => {
    const response = await fetch(`${API_URL}/ventas/pagos/${pagoId}/marcar-fallido`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ motivo }),
    });
    return handleResponse(response);
  },

  revertirPago: async (pagoId, data, customIdempKey = null) => {
    const idempotencyKey = customIdempKey || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-rev-${Date.now()}`
    );

    const response = await fetch(`${API_URL}/ventas/pagos/${pagoId}/revertir`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  conciliarPagoHistorico: async (pagoId, data, customIdempKey = null) => {
    const idempotencyKey = customIdempKey || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-conc-${Date.now()}`
    );

    const response = await fetch(`${API_URL}/ventas/pagos/${pagoId}/conciliar`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

// ============ CARTERA Y CUENTAS POR COBRAR API ============
export const carteraApi = {
  getCartera: async (filtros = {}) => {
    const queryParams = new URLSearchParams(filtros);
    const url = Object.keys(filtros).length > 0
      ? `${API_URL}/ventas/cartera?${queryParams}`
      : `${API_URL}/ventas/cartera`;
    const response = await fetch(url, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getCarteraPorCliente: async () => {
    const response = await fetch(`${API_URL}/ventas/cartera/clientes`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getCuentaPorCobrar: async (cuentaId) => {
    const response = await fetch(`${API_URL}/ventas/cartera/${cuentaId}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  registrarAbono: async (cuentaId, data, customIdempKey = null) => {
    const idempotencyKey = customIdempKey || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-abono-${Date.now()}`
    );

    const response = await fetch(`${API_URL}/ventas/cartera/${cuentaId}/abono`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getEstadoCuentaCliente: async (clienteId) => {
    const response = await fetch(`${API_URL}/ventas/clientes/${clienteId}/estado-cuenta`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
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
  pagos: pagosApi,
  cartera: carteraApi,
  admin: adminApi,
};