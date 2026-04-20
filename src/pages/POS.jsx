import { useState, useEffect, useRef, useCallback } from 'react'
import { inventarioApi, ventasApi } from '../services/api'
import TicketPreview from '../components/TicketPreview'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CreditCard, Banknote, QrCode, Send, X, ScanLine, AlertCircle
} from 'lucide-react'

export default function POS() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [almacenActual, setAlmacenActual] = useState(null)
  const [carrito, setCarrito] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [ventaCompletada, setVentaCompletada] = useState(null)

  // ====== BARCODE ======
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanFeedback, setScanFeedback] = useState(null) // { tipo: 'ok'|'error', msg, ts }
  const barcodeInputRef = useRef(null)
  const audioBeepOk = useRef(null)
  const audioBeepError = useRef(null)

  // Crear beeps sintéticos con Web Audio API (sin assets externos)
  const playBeep = useCallback((ok = true) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = ok ? 880 : 220  // agudo = ok, grave = error
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    } catch (e) { /* silent — no audio API */ }
  }, [])

  const mostrarFeedback = useCallback((tipo, msg) => {
    setScanFeedback({ tipo, msg, ts: Date.now() })
    setTimeout(() => setScanFeedback((f) => (f?.ts && Date.now() - f.ts >= 2500 ? null : f)), 2500)
  }, [])

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
      const [prods, cats, alms] = await Promise.all([
        inventarioApi.getProductos(),
        inventarioApi.getCategorias(),
        inventarioApi.getAlmacenes()
      ])
      setProductos(prods.items || prods || [])
      setCategorias(cats || [])
      setAlmacenes(alms || [])
      // Usar el primer almacén por defecto
      if (alms && alms.length > 0) {
        setAlmacenActual(alms[0].id)
      }
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
      setProductos(data.items || data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const agregarAlCarrito = (producto) => {
    // Obtener la primera variante del producto
    const variante = producto.variantes?.[0]
    const varianteId = variante?.id || producto.variante_id || producto.id
    const precio = variante?.precio_venta || producto.precio_venta || 0

    const existe = carrito.find(item => item.variante_id === varianteId)
    if (existe) {
      setCarrito(carrito.map(item =>
        item.variante_id === varianteId
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ))
    } else {
      setCarrito([...carrito, {
        id: producto.id,
        variante_id: varianteId,
        nombre: producto.nombre,
        precio: Number(precio),
        cantidad: 1,
      }])
    }
  }

  /**
   * Agrega una variante específica al carrito (usado por escaneo de barcode).
   * A diferencia de agregarAlCarrito, NO asume la primera variante:
   * usa exactamente la variante que el backend devolvió.
   */
  const agregarVarianteAlCarrito = useCallback((varianteData) => {
    const varianteId = varianteData.id
    const precio = Number(varianteData.precio_venta) || 0
    const nombre = varianteData.producto_nombre || 'Producto sin nombre'

    // Construir nombre con atributos si existen (ej: "Camiseta — Talla M, Rojo")
    let nombreCompleto = nombre
    if (varianteData.atributos && Object.keys(varianteData.atributos).length > 0) {
      const attrs = Object.values(varianteData.atributos).join(' ')
      if (attrs.trim()) nombreCompleto = `${nombre} — ${attrs}`
    }

    setCarrito((prev) => {
      const existe = prev.find((i) => i.variante_id === varianteId)
      if (existe) {
        return prev.map((i) =>
          i.variante_id === varianteId ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [
        ...prev,
        {
          id: varianteData.producto_id,
          variante_id: varianteId,
          nombre: nombreCompleto,
          precio,
          cantidad: 1,
        },
      ]
    })
  }, [])

  /**
   * Procesa un código de barras escaneado o escrito.
   * - Busca online (con fallback offline en api.js)
   * - Si encuentra: beep ok + agrega variante
   * - Si no encuentra: beep error + feedback visual
   */
  const procesarBarcode = useCallback(async (codigo) => {
    if (!codigo || codigo.trim().length < 4) return
    setBarcodeInput('')  // limpiar input inmediatamente para permitir siguiente escaneo

    try {
      const variante = await inventarioApi.buscarPorBarcode(codigo)
      if (variante) {
        agregarVarianteAlCarrito(variante)
        playBeep(true)
        mostrarFeedback('ok', `${variante.producto_nombre} agregado`)
      } else {
        playBeep(false)
        mostrarFeedback('error', `Código "${codigo}" no registrado`)
      }
    } catch (error) {
      playBeep(false)
      mostrarFeedback('error', `Error al buscar código`)
      console.error('[Barcode] Error:', error)
    }
  }, [agregarVarianteAlCarrito, playBeep, mostrarFeedback])

  // Listener global de escáner HID (estrategia C)
  useBarcodeScanner(procesarBarcode, !modalPago && !ventaCompletada)

  const cambiarCantidad = (varianteId, delta) => {
    setCarrito(carrito.map(item => {
      if (item.variante_id === varianteId) {
        const nuevaCantidad = item.cantidad + delta
        return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : item
      }
      return item
    }).filter(item => item.cantidad > 0))
  }

  const eliminarDelCarrito = (varianteId) => {
    setCarrito(carrito.filter(item => item.variante_id !== varianteId))
  }

  const vaciarCarrito = () => {
    if (carrito.length > 0 && confirm('¿Vaciar el carrito?')) {
      setCarrito([])
    }
  }

  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
  const total = subtotal

  const procesarVenta = async (metodoPago, clienteNombre = '', clienteNit = '', montoRecibido = null) => {
    setProcesando(true)
    try {
      // Formato que espera el backend
      const detalles = carrito.map(item => ({
        variante_id: item.variante_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio
      }))

      // Crear la venta
      const ventaCreada = await ventasApi.createVenta({
        almacen_id: almacenActual,
        detalles: detalles,
        metodo_pago: metodoPago,
        cliente_nombre: clienteNombre || null,
        cliente_nit: clienteNit || null,
        notas: '',
        monto_recibido: montoRecibido || null
      })

      // Si no es offline y está pendiente, completar la venta
      if (!ventaCreada.offline && ventaCreada.estado === 'PENDIENTE') {
        await ventasApi.completarVenta(ventaCreada.id, metodoPago, montoRecibido)
      }

      // Preparar datos para el ticket
      setVentaCompletada({
        numero: ventaCreada.numero || ventaCreada.temp_id,
        total: total,
        subtotal: subtotal,
        descuento: 0,
        metodo_pago: metodoPago,
        cliente_nombre: clienteNombre || 'Mostrador',
        cliente_nit: clienteNit,
        cambio: montoRecibido ? montoRecibido - total : 0,
        items: carrito.map(item => ({
          producto_nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          subtotal: item.cantidad * item.precio
        })),
        created_at: new Date().toISOString(),
        offline: ventaCreada.offline || false,
      })

      setModalPago(false)
    } catch (error) {
      console.error('Error al crear venta:', error)
      alert(error.message || 'Error al procesar la venta')
    } finally {
      setProcesando(false)
    }
  }

  const cerrarTicket = () => {
    setVentaCompletada(null)
    setCarrito([])
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
        {/* Barra de escaneo de código de barras */}
        <div className="mb-3">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500" />
            <input
              ref={barcodeInputRef}
              type="text"
              data-barcode-input="true"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  procesarBarcode(barcodeInput)
                }
              }}
              placeholder="Escanear código de barras o escribir y presionar Enter..."
              className="input pl-10 pr-10 bg-primary-50 border-primary-200 focus:bg-white"
              autoFocus
            />
            {scanFeedback && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  scanFeedback.tipo === 'ok'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {scanFeedback.tipo === 'error' && <AlertCircle className="w-3 h-3" />}
                {scanFeedback.msg}
              </div>
            )}
          </div>
        </div>

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
            {productos.map((producto) => {
              const variante = producto.variantes?.[0]
              const precio = variante?.precio_venta || producto.precio_venta || 0
              return (
                <button
                  key={producto.id}
                  onClick={() => agregarAlCarrito(producto)}
                  className="card p-3 text-left hover:border-primary-300 hover:shadow-md transition-all active:scale-95"
                >
                  <h3 className="font-medium text-gray-900 text-sm truncate">{producto.nombre}</h3>
                  <p className="text-lg font-bold text-primary-600 mt-1">
                    Bs. {Number(precio).toFixed(2)}
                  </p>
                </button>
              )
            })}
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
              <div key={item.variante_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.nombre}</p>
                  <p className="text-sm text-gray-500">Bs. {item.precio.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cambiarCantidad(item.variante_id, -1)}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{item.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(item.variante_id, 1)}
                    className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => eliminarDelCarrito(item.variante_id)}
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

      {/* Modal de ticket con impresión */}
      {ventaCompletada && (
        <TicketPreview 
          venta={ventaCompletada}
          onClose={cerrarTicket}
        />
      )}
    </div>
  )
}

function ModalPago({ total, procesando, onClose, onPagar }) {
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteNit, setClienteNit] = useState('')

  const cambio = metodo === 'EFECTIVO' && montoRecibido 
    ? Number(montoRecibido) - total 
    : 0

  const metodos = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
    { id: 'QR', label: 'QR', icon: QrCode },
    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: 'Transfer', icon: Send },
  ]

  const handleConfirmar = () => {
    onPagar(
      metodo, 
      clienteNombre, 
      clienteNit, 
      montoRecibido ? Number(montoRecibido) : null
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Datos del cliente (opcional) */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del cliente (opcional)
              </label>
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="input"
                placeholder="Cliente mostrador"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIT/CI (opcional)
              </label>
              <input
                type="text"
                value={clienteNit}
                onChange={(e) => setClienteNit(e.target.value)}
                className="input"
                placeholder="Para factura"
              />
            </div>
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
            onClick={handleConfirmar}
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
