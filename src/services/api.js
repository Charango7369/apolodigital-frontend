// Configuración de la API
const API_URL = import.meta.env.VITE_API_URL || 'https://apolodigital-inventario-production.up.railway.app/api/v1'

class ApiService {
  constructor() {
    this.token = null
  }

  setToken(token) {
    this.token = token
  }

  getHeaders(isFormData = false) {
    const headers = {}
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    
    return headers
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`
    
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(options.isFormData),
        ...options.headers,
      },
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error de conexión' }))
      throw new Error(error.detail || `Error ${response.status}`)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' })
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  postForm(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      isFormData: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiService()

// Funciones de conveniencia
export const inventarioApi = {
  // Categorías
  getCategorias: () => api.get('/categorias'),
  createCategoria: (data) => api.post('/categorias', data),
  updateCategoria: (id, data) => api.put(`/categorias/${id}`, data),
  deleteCategoria: (id) => api.delete(`/categorias/${id}`),

  // Proveedores
  getProveedores: () => api.get('/proveedores'),
  createProveedor: (data) => api.post('/proveedores', data),
  updateProveedor: (id, data) => api.put(`/proveedores/${id}`, data),
  deleteProveedor: (id) => api.delete(`/proveedores/${id}`),

  // Almacenes
  getAlmacenes: () => api.get('/almacenes'),

  // Productos
  getProductos: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/productos${query ? `?${query}` : ''}`)
  },
  getProducto: (id) => api.get(`/productos/${id}`),
  createProducto: (data) => api.post('/productos', data),
  updateProducto: (id, data) => api.put(`/productos/${id}`, data),
  deleteProducto: (id) => api.delete(`/productos/${id}`),

  // Stock
  getAlertasStock: () => api.get('/stock/alertas'),
  getStockVariante: (varianteId) => api.get(`/stock/variante/${varianteId}`),

  // Movimientos
  createMovimiento: (data) => api.post('/movimientos', data),
  getMovimientos: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/movimientos${query ? `?${query}` : ''}`)
  },
}

export const ventasApi = {
  // Clientes
  getClientes: (busqueda) => api.get(`/clientes${busqueda ? `?busqueda=${busqueda}` : ''}`),
  createCliente: (data) => api.post('/clientes', data),

  // Ventas
  getVentas: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/ventas${query ? `?${query}` : ''}`)
  },
  getVenta: (id) => api.get(`/ventas/${id}`),
  createVenta: (data) => api.post('/ventas', data),
  completarVenta: (id, data) => api.post(`/ventas/${id}/completar`, data),
  cancelarVenta: (id, motivo) => api.post(`/ventas/${id}/cancelar${motivo ? `?motivo=${motivo}` : ''}`),

  // Reportes
  getReporteVentasDia: (fecha) => api.get(`/reportes/ventas-dia${fecha ? `?fecha=${fecha}` : ''}`),
  getReporteCaja: (fecha) => api.get(`/reportes/caja${fecha ? `?fecha=${fecha}` : ''}`),
}
