import { useState, useEffect } from 'react'
import { inventarioApi } from '../services/api'
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [productoEdit, setProductoEdit] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProductos()
    }, 300)
    return () => clearTimeout(timer)
  }, [busqueda, categoriaFiltro])

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([
        inventarioApi.getProductos(),
        inventarioApi.getCategorias()
      ])
      setProductos(prods.items || [])
      setCategorias(cats)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProductos = async () => {
    try {
      const params = {}
      if (busqueda) params.busqueda = busqueda
      if (categoriaFiltro) params.categoria_id = categoriaFiltro
      const data = await inventarioApi.getProductos(params)
      setProductos(data.items || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este producto?')) return
    try {
      await inventarioApi.deleteProducto(id)
      loadProductos()
    } catch (error) {
      alert(error.message)
    }
  }

  const openModal = (producto = null) => {
    setProductoEdit(producto)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setProductoEdit(null)
  }

  const handleSave = async (data) => {
    try {
      if (productoEdit) {
        await inventarioApi.updateProducto(productoEdit.id, data)
      } else {
        await inventarioApi.createProducto(data)
      }
      closeModal()
      loadProductos()
    } catch (error) {
      alert(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500">{productos.length} productos</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      {/* Lista de productos */}
      {productos.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay productos</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            Crear primer producto
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productos.map((producto) => (
            <div key={producto.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{producto.nombre}</h3>
                  {producto.codigo_barras && (
                    <p className="text-sm text-gray-500">{producto.codigo_barras}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => openModal(producto)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(producto.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <span className="text-2xl font-bold text-primary-600">
                  Bs. {Number(producto.precio_venta || 0).toFixed(2)}
                </span>
                <span className={`badge ${producto.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              <div className="mt-2 text-sm text-gray-500">
                {producto.unidad_medida} • {producto.es_servicio ? 'Servicio' : 'Producto'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ProductoModal
          producto={productoEdit}
          categorias={categorias}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function ProductoModal({ producto, categorias, onClose, onSave }) {
  // Los precios viven en la variante default del producto, no en el producto.
  // Cuando editamos, leemos de producto.variantes[0]. Si ese producto fue
  // creado antes del fix de backend, producto.precio_venta puede existir
  // como fallback — lo respetamos.
  const varianteDefault = producto?.variantes?.[0]
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    categoria_id: producto?.categoria_id || '',
    codigo_barras: producto?.codigo_barras || '',
    unidad_medida: producto?.unidad_medida || 'unidad',
    precio_venta: varianteDefault?.precio_venta || producto?.precio_venta || '',
    precio_costo: varianteDefault?.precio_costo || '',
    es_servicio: producto?.es_servicio || false,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    const data = {
      ...form,
      precio_venta: form.precio_venta ? Number(form.precio_venta) : null,
      precio_costo: form.precio_costo ? Number(form.precio_costo) : null,
      categoria_id: form.categoria_id || null,
    }
    
    await onSave(data)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {producto ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="input"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={form.categoria_id}
              onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              className="input"
            >
              <option value="">Sin categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precio_venta}
                onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
                className="input"
                required={!producto}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio costo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precio_costo}
                onChange={(e) => setForm({ ...form, precio_costo: e.target.value })}
                className="input"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
              <input
                type="text"
                value={form.codigo_barras}
                onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <select
                value={form.unidad_medida}
                onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
                className="input"
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="metro">Metro</option>
              </select>
            </div>
          </div>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.es_servicio}
              onChange={(e) => setForm({ ...form, es_servicio: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Es un servicio (no descuenta stock)</span>
          </label>
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
