import { useState, useEffect } from 'react'
import { inventarioApi, ventasApi } from '../services/api'
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, 
  CreditCard, Banknote, QrCode, Send, X, Check
} from 'lucide-react'

export default function POS() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [carrito, setCarrito] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [ventaExitosa, setVentaExitosa] = useState(null)

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
      console.error('Error:', error)
    }
  }

  const agregarAlCarrito = (producto) => {
    const existe = carrito.find(item => item.id === producto.id)
    if (existe) {
      setCarrito(carrito.map(item =>
        item.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ))
    } else {
      setCarrito([...carrito, {
        id: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio_venta || 0),
        cantidad: 1,
        variante_id: producto.variante_id // Necesitamos obtener esto
      }])
    }
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(carrito.map(item => {
      if (item.id === id) {
        const nuevaCantidad = item.cantidad + delta
        return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : item
      }
      return item
    }).filter(item => item.cantidad > 0))
  }

  const eliminarDelCarrito = (id) => {
    setCarrito(carrito.filter(item => item.id !== id))
  }

  const vaciarCarrito = () => {
    if (carrito.length > 0 && confirm('¿Vaciar el carrito?')) {
      setCarrito([])
    }
  }

  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
  const total = subtotal

  const procesarVenta = async (metodoPago, montoRecibido = null) => {
    setProcesando(true)
    try {
      // Primero necesitamos obtener las variantes de los productos
      const detalles = await Promise.all(carrito.map(async (item) => {
        // Obtener producto completo para tener variante_id
        const producto = await inventarioApi.getProducto(item.id)
        const variante = producto.variantes?.[0]
        if (!variante) throw new Error(`Producto ${item.nombre} sin variante`)
        return {
          variante_id: variante.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio
        }
      }))

      const venta = await ventasApi.createVenta({
        detalles,
        metodo_pago: metodoPago,
        monto_recibido: montoRecibido,
        completar: true
      })

      setVentaExitosa(venta)
      setCarrito([])
      setModalPago(false)
    } catch (error) {
      alert(error.message)
    } finally {
      setProcesando(false)
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
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Productos */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="input sm:w-40"
          >
            <option value="">Todas</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {productos.map((producto) => (
              <button
                key={producto.id}
                onClick={() => agregarAlCarrito(producto)}
                className="card p-3 text-left hover:border-primary-300 hover:shadow-md transition-all active:scale-95"
              >
                <h3 className="font-medium text-gray-900 text-sm truncate">{producto.nombre}</h3>
                <p className="text-lg font-bold text-primary-600 mt-1">
                  Bs. {Number(producto.precio_venta || 0).toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Carrito */}
      <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Carrito ({carrito.length})
          </h2>
          {carrito.length > 0 && (
            <button onClick={vaciarCarrito} className="text-sm text-red-600 hover:text-red-700">
              Vaciar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {carrito.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Carrito vacío</p>
          ) : (
            carrito.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.nombre}</p>
                  <p className="text-sm text-gray-500">Bs. {item.precio.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cambiarCantidad(item.id, -1)}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{item.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(item.id, 1)}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => eliminarDelCarrito(item.id)}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total y botón de pago */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between text-lg font-bold mb-4">
            <span>Total:</span>
            <span className="text-primary-600">Bs. {total.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setModalPago(true)}
            disabled={carrito.length === 0}
            className="btn btn-primary w-full py-3 text-lg"
          >
            Cobrar
          </button>
        </div>
      </div>

      {/* Modal de pago */}
      {modalPago && (
        <ModalPago
          total={total}
          procesando={procesando}
          onClose={() => setModalPago(false)}
          onPagar={procesarVenta}
        />
      )}

      {/* Modal de venta exitosa */}
      {ventaExitosa && (
        <ModalExito
          venta={ventaExitosa}
          onClose={() => setVentaExitosa(null)}
        />
      )}
    </div>
  )
}

function ModalPago({ total, procesando, onClose, onPagar }) {
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [montoRecibido, setMontoRecibido] = useState('')

  const cambio = metodo === 'EFECTIVO' && montoRecibido 
    ? Number(montoRecibido) - total 
    : 0

  const metodos = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
    { id: 'QR', label: 'QR', icon: QrCode },
    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: 'Transfer', icon: Send },
  ]

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Método de pago</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center">
            <p className="text-gray-500">Total a cobrar</p>
            <p className="text-3xl font-bold text-primary-600">Bs. {total.toFixed(2)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {metodos.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
                  metodo === m.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <m.icon className={`w-6 h-6 ${metodo === m.id ? 'text-primary-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${metodo === m.id ? 'text-primary-700' : 'text-gray-600'}`}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>

          {metodo === 'EFECTIVO' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto recibido
              </label>
              <input
                type="number"
                step="0.01"
                min={total}
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                className="input text-lg"
                placeholder="0.00"
                autoFocus
              />
              {cambio > 0 && (
                <p className="mt-2 text-lg font-semibold text-green-600">
                  Cambio: Bs. {cambio.toFixed(2)}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => onPagar(metodo, montoRecibido ? Number(montoRecibido) : null)}
            disabled={procesando || (metodo === 'EFECTIVO' && Number(montoRecibido || 0) < total)}
            className="btn btn-success w-full py-3 text-lg"
          >
            {procesando ? 'Procesando...' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalExito({ venta, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm text-center p-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Venta exitosa!</h2>
        <p className="text-gray-500 mb-4">Ticket #{venta.numero}</p>
        <p className="text-2xl font-bold text-primary-600 mb-6">
          Bs. {Number(venta.total).toFixed(2)}
        </p>
        {venta.cambio > 0 && (
          <p className="text-lg text-green-600 mb-4">
            Cambio: Bs. {Number(venta.cambio).toFixed(2)}
          </p>
        )}
        <button onClick={onClose} className="btn btn-primary w-full">
          Nueva venta
        </button>
      </div>
    </div>
  )
}
