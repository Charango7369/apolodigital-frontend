import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { inventarioApi, ventasApi } from '../services/api'
import TicketPreview from '../components/TicketPreview'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CreditCard, Banknote, QrCode, Send, X, ScanLine, AlertCircle,
  Clock, Layers, CheckCircle2, UserCheck
} from 'lucide-react'

export default function POS() {
  const queryClient = useQueryClient()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [almacenActual, setAlmacenActual] = useState(
    () => localStorage.getItem('apolodigital_almacen_id') || null
  )
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

      // Autoselección inteligente:
      // 1. Si hay un almacén guardado en localStorage y sigue existiendo → usarlo
      // 2. Si hay exactamente 1 almacén → seleccionarlo automático (sin pregunta)
      // 3. Si hay varios → el cajero elige (selector visible)
      if (alms && alms.length > 0) {
        const guardado = localStorage.getItem('apolodigital_almacen_id')
        const sigueExistiendo = guardado && alms.find(a => a.id === guardado)
        if (sigueExistiendo) {
          setAlmacenActual(guardado)
        } else {
          // Autoseleccionar el primero (caso dominante: 1 solo almacén)
          const id = alms[0].id
          setAlmacenActual(id)
          localStorage.setItem('apolodigital_almacen_id', id)
        }
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
          ? { ...item, cantidad: (parseFloat(item.cantidad) || 0) + 1 }
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
          i.variante_id === varianteId ? { ...i, cantidad: (parseFloat(i.cantidad) || 0) + 1 } : i
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

  const cambiarAlmacen = (id) => {
    setAlmacenActual(id)
    localStorage.setItem('apolodigital_almacen_id', id)
  }

  const cambiarCantidad = (varianteId, delta) => {
    setCarrito(carrito.map(item => {
      if (item.variante_id === varianteId) {
        const actual = parseFloat(item.cantidad) || 0
        const nuevaCantidad = Math.max(1, Math.round((actual + delta) * 1000) / 1000)
        return { ...item, cantidad: nuevaCantidad }
      }
      return item
    }))
  }

  const actualizarCantidadDirecta = (varianteId, valor) => {
    // Permitir campo vacío temporalmente mientras el usuario borra/escribe
    if (valor === '') {
      setCarrito(carrito.map(item =>
        item.variante_id === varianteId ? { ...item, cantidad: '' } : item
      ))
      return
    }

    // Aceptar cualquier número positivo (entero o decimal)
    const num = parseFloat(valor)
    if (!isNaN(num) && num >= 0) {
      setCarrito(carrito.map(item =>
        item.variante_id === varianteId ? { ...item, cantidad: valor } : item
      ))
    }
  }

  const validarCantidad = (varianteId) => {
    setCarrito(carrito.map(item => {
      if (item.variante_id === varianteId) {
        const num = parseFloat(item.cantidad)
        const valorValido = !isNaN(num) && num > 0 ? num : 1
        return { ...item, cantidad: valorValido }
      }
      return item
    }))
  }

  const eliminarDelCarrito = (varianteId) => {
    setCarrito(carrito.filter(item => item.variante_id !== varianteId))
  }

  const vaciarCarrito = () => {
    if (carrito.length > 0 && confirm('¿Vaciar el carrito?')) {
      setCarrito([])
    }
  }

  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * (parseFloat(item.cantidad) || 0)), 0)
  const total = subtotal

  const procesarVenta = async ({
    metodoPago,
    clienteId = null,
    clienteNombre = '',
    clienteNit = '',
    montoRecibido = null,
    pagos = [],
    esCredito = false,
    fechaVencimiento = null,
  }) => {
    setProcesando(true)
    try {
      const detalles = carrito.map(item => {
        const cant = parseFloat(item.cantidad)
        return {
          variante_id: item.variante_id,
          cantidad: !isNaN(cant) && cant > 0 ? cant : 1,
          precio_unitario: item.precio
        }
      })

      const idempKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      // Preparar desglose de pagos financieros
      let pagosPayload = []
      if (metodoPago === 'MIXTO' || metodoPago === 'CREDITO') {
        pagosPayload = pagos
      } else {
        pagosPayload = [{
          monto: total,
          metodo_pago: metodoPago,
          referencia: null
        }]
      }

      const payload = {
        almacen_id: almacenActual,
        cliente_id: clienteId || null,
        cliente_nombre: clienteNombre || null,
        cliente_nit: clienteNit || null,
        detalles: detalles,
        descuento: 0,
        metodo_pago: metodoPago,
        monto_recibido: metodoPago === 'EFECTIVO' ? (montoRecibido || null) : null,
        notas: '',
        completar: true,
        pagos: pagosPayload,
        es_credito: esCredito,
        fecha_vencimiento: fechaVencimiento || null,
        idempotency_key: idempKey,
      }

      const ventaCreada = await ventasApi.createVenta(payload, idempKey)

      if (!ventaCreada.offline && ventaCreada.estado === 'PENDIENTE') {
        await ventasApi.completarVenta(ventaCreada.id, metodoPago, montoRecibido)
      }

      if (!ventaCreada.offline) {
        queryClient.invalidateQueries({ queryKey: ['stockActual'] })
        queryClient.invalidateQueries({ queryKey: ['alertasStock'] })
        queryClient.invalidateQueries({ queryKey: ['utilidadPeriodo'] })
        queryClient.invalidateQueries({ queryKey: ['utilidadProductos'] })
        queryClient.invalidateQueries({ queryKey: ['cartera'] })
      }

      // Preparar datos para el ticket (autoridad del backend)
      setVentaCompletada({
        id: ventaCreada.id,
        numero: ventaCreada.numero || ventaCreada.temp_id,
        total: Number(ventaCreada.total || total),
        subtotal: Number(ventaCreada.subtotal || subtotal),
        descuento: Number(ventaCreada.descuento || 0),
        metodo_pago: ventaCreada.metodo_pago || metodoPago,
        estado: ventaCreada.estado || 'COMPLETADA',
        estado_financiero: ventaCreada.estado_financiero || (esCredito ? 'CREDIT' : 'PAID'),
        cliente_nombre: clienteNombre || 'Mostrador',
        cliente_nit: clienteNit,
        cambio: (metodoPago === 'EFECTIVO' && montoRecibido) ? montoRecibido - total : 0,
        pagos: ventaCreada.pagos || pagosPayload,
        items: carrito.map(item => {
          const cant = parseFloat(item.cantidad)
          const cantidadValida = !isNaN(cant) && cant > 0 ? cant : 1
          return {
            producto_nombre: item.nombre,
            cantidad: cantidadValida,
            precio_unitario: item.precio,
            subtotal: cantidadValida * item.precio
          }
        }),
        created_at: ventaCreada.created_at || new Date().toISOString(),
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
          {almacenes.length > 1 && (
            <select
              value={almacenActual || ''}
              onChange={(e) => cambiarAlmacen(e.target.value)}
              className="input sm:w-48"
            >
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          )}
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
            carrito.map((item) => {
              const cantidadNum = parseFloat(item.cantidad) || 0
              return (
                <div key={item.variante_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate" title={item.nombre}>
                      {item.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      Bs. {item.precio.toFixed(2)} c/u
                      {cantidadNum > 1 && (
                        <span className="block font-medium text-primary-700">
                          Subtotal: Bs. {(cantidadNum * item.precio).toFixed(2)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.variante_id, -1)}
                      className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 transition-all"
                      title="Disminuir 1"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidadDirecta(item.variante_id, e.target.value)}
                      onBlur={() => validarCantidad(item.variante_id)}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      className="w-16 sm:w-20 text-center font-semibold text-gray-800 bg-white border border-gray-300 rounded-lg py-1 px-1 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none input-no-spinner shadow-inner"
                      title="Haz clic para escribir la cantidad directamente"
                    />
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.variante_id, 1)}
                      className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 transition-all"
                      title="Aumentar 1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarDelCarrito(item.variante_id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 active:scale-95 transition-all ml-0.5"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })
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
  const [montoRecibido, setMontoRecibido] = useState(total ? total.toFixed(2) : '')
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteNit, setClienteNit] = useState('')

  useEffect(() => {
    if (total && !montoRecibido) {
      setMontoRecibido(total.toFixed(2))
    }
  }, [total])

  // Para Crédito
  const [fechaVencimiento, setFechaVencimiento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [anticipoCredito, setAnticipoCredito] = useState('')

  // Para Pago Mixto
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoQr, setMontoQr] = useState('')
  const [montoTarjeta, setMontoTarjeta] = useState('')
  const [montoTransfer, setMontoTransfer] = useState('')

  useEffect(() => {
    ventasApi.getClientes({ solo_activos: true }).then((data) => {
      setClientes(data || [])
    }).catch(() => {})
  }, [])

  const handleSelectCliente = (id) => {
    setClienteSeleccionadoId(id)
    const c = clientes.find((x) => x.id === id)
    if (c) {
      setClienteNombre(c.nombre)
      setClienteNit(c.nit || '')
    } else {
      setClienteNombre('')
      setClienteNit('')
    }
  }

  const metodos = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
    { id: 'QR', label: 'QR', icon: QrCode },
    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: 'Transfer', icon: Send },
    { id: 'CREDITO', label: 'Crédito', icon: Clock },
    { id: 'MIXTO', label: 'Mixto', icon: Layers },
  ]

  // Cálculos de Mixto
  const sumMixto = (Number(montoEfectivo) || 0) + (Number(montoQr) || 0) + (Number(montoTarjeta) || 0) + (Number(montoTransfer) || 0)
  const diferenciaMixto = total - sumMixto

  const efectivoNum = montoRecibido === '' ? total : Number(montoRecibido)
  const cambioEfectivo = metodo === 'EFECTIVO' && efectivoNum > total
    ? efectivoNum - total
    : 0

  const handleConfirmar = () => {
    if (metodo === 'CREDITO') {
      if (!clienteSeleccionadoId) {
        alert('Para ventas a crédito debe seleccionar un cliente registrado en el sistema.')
        return
      }
      const pagos = []
      const ant = Number(anticipoCredito) || 0
      if (ant > 0) {
        pagos.push({ monto: ant, metodo_pago: 'EFECTIVO', referencia: 'Anticipo' })
      }
      onPagar({
        metodoPago: 'CREDITO',
        clienteId: clienteSeleccionadoId,
        clienteNombre,
        clienteNit,
        montoRecibido: ant > 0 ? ant : null,
        pagos,
        esCredito: true,
        fechaVencimiento,
      })
      return
    }

    if (metodo === 'MIXTO') {
      if (Math.abs(diferenciaMixto) > 0.01) {
        alert(`El total del desglose (Bs. ${sumMixto.toFixed(2)}) debe coincidir exactamente con el total a cobrar (Bs. ${total.toFixed(2)}).`)
        return
      }
      const pagos = []
      if (Number(montoEfectivo) > 0) pagos.push({ monto: Number(montoEfectivo), metodo_pago: 'EFECTIVO' })
      if (Number(montoQr) > 0) pagos.push({ monto: Number(montoQr), metodo_pago: 'QR' })
      if (Number(montoTarjeta) > 0) pagos.push({ monto: Number(montoTarjeta), metodo_pago: 'TARJETA' })
      if (Number(montoTransfer) > 0) pagos.push({ monto: Number(montoTransfer), metodo_pago: 'TRANSFERENCIA' })

      onPagar({
        metodoPago: 'MIXTO',
        clienteId: clienteSeleccionadoId || null,
        clienteNombre,
        clienteNit,
        montoRecibido: Number(montoEfectivo) || null,
        pagos,
        esCredito: false,
      })
      return
    }

    const efectivoFinal = montoRecibido === '' ? total : Number(montoRecibido)

    onPagar({
      metodoPago: metodo,
      clienteId: clienteSeleccionadoId || null,
      clienteNombre,
      clienteNit,
      montoRecibido: metodo === 'EFECTIVO' ? efectivoFinal : null,
      pagos: [{ monto: total, metodo_pago: metodo }],
      esCredito: false,
    })
  }

  const esBotonDeshabilitado = () => {
    if (procesando) return true
    if (metodo === 'EFECTIVO') {
      const efectivo = montoRecibido === '' ? total : Number(montoRecibido)
      if (isNaN(efectivo) || efectivo < total) return true
    }
    if (metodo === 'CREDITO' && !clienteSeleccionadoId) return true
    if (metodo === 'MIXTO' && Math.abs(diferenciaMixto) > 0.01) return true
    return false
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Método de cobro</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center bg-gray-50 p-3 rounded-lg border border-gray-100">
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">Total a cobrar</p>
            <p className="text-3xl font-extrabold text-primary-600">Bs. {total.toFixed(2)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metodos.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${
                  metodo === m.id
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <m.icon className={`w-5 h-5 ${metodo === m.id ? 'text-primary-600' : 'text-gray-400'}`} />
                <span className="text-xs font-semibold">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Selector de Cliente */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-1">
                <UserCheck className="w-4 h-4 text-primary-600" />
                Cliente {metodo === 'CREDITO' ? '(Obligatorio)' : '(Opcional)'}
              </label>
              {clienteSeleccionadoId && (
                <button
                  type="button"
                  onClick={() => handleSelectCliente('')}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Cambiar a mostrador
                </button>
              )}
            </div>

            <select
              value={clienteSeleccionadoId}
              onChange={(e) => handleSelectCliente(e.target.value)}
              className={`input text-sm ${metodo === 'CREDITO' && !clienteSeleccionadoId ? 'border-amber-400 bg-amber-50' : ''}`}
            >
              <option value="">-- Cliente Mostrador / Sin registrar --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.telefono ? `(${c.telefono})` : ''} {c.nit ? `[NIT: ${c.nit}]` : ''}
                </option>
              ))}
            </select>

            {!clienteSeleccionadoId && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="input text-xs"
                  placeholder="Nombre mostrador..."
                />
                <input
                  type="text"
                  value={clienteNit}
                  onChange={(e) => setClienteNit(e.target.value)}
                  className="input text-xs"
                  placeholder="NIT / CI factura..."
                />
              </div>
            )}
          </div>

          {/* VENTA EFECTIVO */}
          {metodo === 'EFECTIVO' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-emerald-800 uppercase">
                  Monto recibido en efectivo
                </label>
                <button
                  type="button"
                  onClick={() => setMontoRecibido(total.toFixed(2))}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors"
                >
                  Pago Exacto
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min={total}
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="input text-xl font-bold text-center bg-white"
                placeholder={total.toFixed(2)}
                autoFocus
              />
              {cambioEfectivo > 0 && (
                <div className="flex justify-between items-center bg-white p-2 rounded border border-emerald-300">
                  <span className="text-xs font-semibold text-emerald-700">Cambio al cliente:</span>
                  <span className="text-lg font-extrabold text-emerald-600">Bs. {cambioEfectivo.toFixed(2)}</span>
                </div>
              )}
              {/* Sugerencias de billetes rápidos */}
              <div className="flex gap-1.5 justify-center flex-wrap pt-1">
                {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                  .filter((val, idx, arr) => val >= total && arr.indexOf(val) === idx)
                  .slice(0, 4)
                  .map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMontoRecibido(val.toFixed(2))}
                      className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors border ${
                        Number(montoRecibido) === val
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      Bs. {val.toFixed(2)}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* VENTA QR */}
          {metodo === 'QR' && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-sky-600" />
                Pago QR Simple
              </p>
              <p>El cobro de <strong>Bs. {total.toFixed(2)}</strong> nacerá en estado <em>PENDING</em> hasta su verificación bancaria en caja.</p>
            </div>
          )}

          {/* VENTA A CRÉDITO */}
          {metodo === 'CREDITO' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase">
                <Clock className="w-4 h-4 text-amber-600" />
                Condiciones del Crédito (Cuenta por Cobrar)
              </div>

              <div>
                <label className="block text-xs text-amber-800 mb-1">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="input text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-amber-800 mb-1">Anticipo / Abono inicial (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={total}
                  value={anticipoCredito}
                  onChange={(e) => setAnticipoCredito(e.target.value)}
                  className="input text-sm bg-white"
                  placeholder="0.00"
                />
              </div>

              <div className="flex justify-between text-xs font-bold text-amber-900 border-t border-amber-200 pt-2">
                <span>Saldo financiado a cartera:</span>
                <span>Bs. {(total - (Number(anticipoCredito) || 0)).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* PAGO MIXTO */}
          {metodo === 'MIXTO' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-900 uppercase">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  Desglose de Métodos
                </span>
                <span className={`font-mono ${Math.abs(diferenciaMixto) < 0.01 ? 'text-emerald-600 font-bold' : 'text-amber-600'}`}>
                  {Math.abs(diferenciaMixto) < 0.01 ? 'Cubierto 100%' : `Resta: Bs. ${diferenciaMixto.toFixed(2)}`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-gray-600">Efectivo (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoEfectivo}
                    onChange={(e) => setMontoEfectivo(e.target.value)}
                    className="input text-xs bg-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-gray-600">QR (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoQr}
                    onChange={(e) => setMontoQr(e.target.value)}
                    className="input text-xs bg-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-gray-600">Tarjeta (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoTarjeta}
                    onChange={(e) => setMontoTarjeta(e.target.value)}
                    className="input text-xs bg-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-gray-600">Transferencia (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoTransfer}
                    onChange={(e) => setMontoTransfer(e.target.value)}
                    className="input text-xs bg-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleConfirmar}
            disabled={esBotonDeshabilitado()}
            className="btn btn-success w-full py-3 text-base font-bold shadow-md disabled:opacity-50"
          >
            {procesando ? 'Procesando transacción...' : 'Confirmar Venta Financiera'}
          </button>
        </div>
      </div>
    </div>
  )
}
