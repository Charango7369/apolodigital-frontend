import BuscadorProductosAsync from '../components/BuscadorProductosAsync';
import { useState, useEffect, useRef } from 'react'
import { inventarioApi } from '../services/api'
import {
  Package,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  Filter,
} from 'lucide-react'

const TIPO_LABELS = {
  ENTRADA_COMPRA: { label: 'Entrada compra', color: 'bg-green-100 text-green-700', icon: ArrowDownCircle },
  SALIDA_VENTA: { label: 'Venta', color: 'bg-blue-100 text-blue-700', icon: ArrowUpCircle },
  AJUSTE_POSITIVO: { label: 'Ajuste (+)', color: 'bg-yellow-100 text-yellow-700', icon: TrendingUp },
  AJUSTE_NEGATIVO: { label: 'Ajuste (−)', color: 'bg-orange-100 text-orange-700', icon: TrendingDown },
  TRANSFERENCIA_ENTRADA: { label: 'Transfer. entrada', color: 'bg-purple-100 text-purple-700', icon: ArrowDownCircle },
  TRANSFERENCIA_SALIDA: { label: 'Transfer. salida', color: 'bg-purple-100 text-purple-700', icon: ArrowUpCircle },
  DEVOLUCION_CLIENTE: { label: 'Devol. cliente', color: 'bg-teal-100 text-teal-700', icon: RotateCcw },
  DEVOLUCION_PROVEEDOR: { label: 'Devol. proveedor', color: 'bg-red-100 text-red-700', icon: RotateCcw },
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [productosCache, setProductosCache] = useState({}) // ✅ Caché por ID
  const [almacenes, setAlmacenes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [modalActivo, setModalActivo] = useState(null)
  
  const productosCacheRef = useRef({}) // Ref para acceso inmediato

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    cargarMovimientos()
  }, [filtroTipo, pagina])

  const cargarDatos = async () => {
    try {
      const [prods, alms, provs] = await Promise.all([
        inventarioApi.getProductos({ per_page: 100 }),
        inventarioApi.getAlmacenes(),
        inventarioApi.getProveedores(true),
      ])
      setProductos(prods.items || prods || [])
      setAlmacenes(alms || [])
      setProveedores(provs || [])
    } catch (e) {
      console.error('Error cargando datos base:', e)
    }
  }

  // ✅ NUEVA FUNCIÓN: Fetch de productos faltantes
  const fetchProductosFaltantes = async (varianteIds) => {
    const idsFaltantes = varianteIds.filter(id => !productosCacheRef.current[id])
    
    if (idsFaltantes.length === 0) return
    
    console.log(`🔍 Buscando ${idsFaltantes.length} productos faltantes...`)
    
    const nuevosProductos = {}
    
    await Promise.all(
      idsFaltantes.map(async (varianteId) => {
        try {
          const token = localStorage.getItem('token')
          const API_URL = import.meta.env.VITE_API_URL;
          
          // Buscar el producto que contiene esta variante
          const response = await fetch(
            `${API_URL}/productos?variante_id=${varianteId}&per_page=1`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
              }
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            const producto = data.items?.[0] || data[0]?.[0]
            
              if (producto) {
                // Validar que el producto recibido realmente contenga la variante solicitada
                const contieneVariante = producto.variantes?.some(v => v.id === varianteId) || producto.id === varianteId;
              
                if (contieneVariante) {
                  nuevosProductos[varianteId] = producto;
                } else {
                  // El backend ignoró el filtro y devolvió basura. 
                  // Guardamos un placeholder para no romper la tabla ni reintentar infinitamente.
                  nuevosProductos[varianteId] = { 
                    nombre: 'Error de sincronización', 
                    variantes: [{ id: varianteId, sku: null }] 
                  };
                }
              }
          }
        } catch (error) {
          console.error(`Error fetching variante ${varianteId}:`, error)
        }
      })
    )
    
    if (Object.keys(nuevosProductos).length > 0) {
      productosCacheRef.current = { ...productosCacheRef.current, ...nuevosProductos }
      setProductosCache(prev => ({ ...prev, ...nuevosProductos }))
      console.log(`✅ Cacheados ${Object.keys(nuevosProductos).length} productos`)
    }
  }

  const cargarMovimientos = async () => {
    try {
      setLoading(true)
      const params = { page: pagina, per_page: 20 }
      if (filtroTipo) params.tipo = filtroTipo
      const data = await inventarioApi.getMovimientos(params)
      
      const movimientosList = data.items || []
      setMovimientos(movimientosList)
      setTotalPaginas(data.pages || 1)
      
      // ✅ Fetch de productos faltantes
      const varianteIds = movimientosList.map(m => m.variante_id).filter(Boolean)
      await fetchProductosFaltantes(varianteIds)
      
    } catch (e) {
      console.error('Error cargando movimientos:', e)
    } finally {
      setLoading(false)
    }
  }

  const registrarCompra = async (data) => {
    try {
      await inventarioApi.crearLote(data)
      setModalActivo(null)
      setPagina(1)
      await cargarDatos()
      await cargarMovimientos()
    } catch (error) {
      console.error('Error al registrar compra:', error)
      alert(error.message || 'Error al registrar compra')
      throw error
    }
  }

  const registrarMovimiento = async (data) => {
    try {
      await inventarioApi.crearMovimiento(data)
      setModalActivo(null)
      setPagina(1)
      await cargarDatos()
      await cargarMovimientos()
    } catch (error) {
      alert(error.message || 'Error al registrar movimiento')
      throw error
    }
  }

  const agregarProductosAlCache = (productosNuevos) => {
    const nuevos = {}
    productosNuevos.forEach(p => {
      if (p.variantes) {
        p.variantes.forEach(v => {
          nuevos[v.id] = p
        })
      }
    })
    
    productosCacheRef.current = { ...productosCacheRef.current, ...nuevos }
    setProductosCache(prev => ({ ...prev, ...nuevos }))
  }

  // ✅ MEJORADA: Busca en productos, caché y productosCache
  const getProductoDeVariante = (varianteId) => {
    if (!varianteId) return { nombre: '—', sku: null }

    // 1. Buscar en productos principales
    for (const p of productos) {
      if (!p.variantes) continue
      const v = p.variantes.find((v) => v.id === varianteId)
      if (v) return { nombre: p.nombre, sku: v.sku }
    }

    // 2. Buscar en caché de productos buscados
    if (productosCache[varianteId]) {
      const p = productosCache[varianteId]
      const v = p.variantes?.find((v) => v.id === varianteId)
      return { nombre: p.nombre, sku: v?.sku || null }
    }

    // 3. No encontrado
    return { nombre: 'Producto no encontrado', sku: null }
  }

  const getAlmacen = (id) => almacenes.find((a) => a.id === id)?.nombre || '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimientos de inventario</h1>
          <p className="text-sm text-gray-500">Historial completo de entradas, salidas y ajustes</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setModalActivo('compra')}
          className="card hover:border-green-300 hover:shadow-md transition-all text-left p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <ArrowDownCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Entrada compra</p>
            <p className="text-xs text-gray-500">Mercadería de proveedor</p>
          </div>
        </button>

        <button
          onClick={() => setModalActivo('ajuste')}
          className="card hover:border-yellow-300 hover:shadow-md transition-all text-left p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Ajuste de stock</p>
            <p className="text-xs text-gray-500">Conteo físico o merma</p>
          </div>
        </button>

        <button
          onClick={() => setModalActivo('devolucion')}
          className="card hover:border-teal-300 hover:shadow-md transition-all text-left p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Devolución</p>
            <p className="text-xs text-gray-500">Cliente o proveedor</p>
          </div>
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value)
              setPagina(1)
            }}
            className="input max-w-xs"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={cargarMovimientos} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay movimientos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Producto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Almacén</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Cantidad</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Costo u.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const tipo = TIPO_LABELS[m.tipo] || { label: m.tipo, color: 'bg-gray-100', icon: Package }
                  const Icon = tipo.icon
                  const prod = getProductoDeVariante(m.variante_id)
                  return (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('es-BO', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${tipo.color} inline-flex items-center gap-1`}>
                          <Icon className="w-3 h-3" /> {tipo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{prod.nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{getAlmacen(m.almacen_id)}</td>
                      <td className="px-4 py-3 text-right font-medium">{Number(m.cantidad).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {m.costo_unitario ? `Bs. ${Number(m.costo_unitario).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                        {m.motivo && m.motivo.trim() ? (
                          m.motivo
                        ) : m.tipo === 'ENTRADA_COMPRA' ? (
                          <span className="text-gray-400 italic">Compra</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-600">Página {pagina} de {totalPaginas}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="btn btn-secondary text-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="btn btn-secondary text-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {modalActivo === 'compra' && (
        <ModalCompra
          productos={productos}
          almacenes={almacenes}
          proveedores={proveedores}
          onClose={() => setModalActivo(null)}
          onSave={registrarCompra}
          onProductosBuscados={agregarProductosAlCache}
        />
      )}
      {modalActivo === 'ajuste' && (
        <ModalAjuste
          productos={productos}
          almacenes={almacenes}
          onClose={() => setModalActivo(null)}
          onSave={registrarMovimiento}
        />
      )}
      {modalActivo === 'devolucion' && (
        <ModalDevolucion
          productos={productos}
          almacenes={almacenes}
          onClose={() => setModalActivo(null)}
          onSave={registrarMovimiento}
        />
      )}
    </div>
  )
}

// ============ MODAL: Entrada de compra ============
function ModalCompra({ productos, almacenes, proveedores, onClose, onSave, onProductosBuscados }) {
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [almacenId, setAlmacenId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [motivo, setMotivo] = useState(''); // ✅ CAMBIADO: motivo en lugar de observaciones
  const [guardando, setGuardando] = useState(false);

  const variante = productoSeleccionado?.variantes?.[0];

  const handleSubmit = async () => {
    if (guardando) return;

    if (!productoSeleccionado) {
      alert('Debes seleccionar un producto de la lista.');
      return;
    }

    if (!variante) {
      alert('⚠️ El producto seleccionado no tiene variantes registradas.');
      return;
    }

    if (!almacenId) {
      alert('⚠️ Debes seleccionar un almacén de la lista desplegable.');
      return;
    }

    if (!proveedorId) {
      alert('⚠️ Debes seleccionar un proveedor de la lista desplegable.');
      return;
    }

    const cantidadNum = Number(cantidad);
    const costoUnitarioNum = Number(costoUnitario);

    if (!cantidad || Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      alert('La cantidad debe ser un número mayor a 0');
      return;
    }

    if (!costoUnitario || Number.isNaN(costoUnitarioNum) || costoUnitarioNum <= 0) {
      alert('El costo unitario debe ser un número mayor a 0');
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        variante_id: variante.id,
        almacen_id: almacenId,
        proveedor_id: proveedorId,
        cantidad: cantidadNum,
        costo_unitario: costoUnitarioNum,
        numero_lote: numeroLote.trim() || null,
        fecha_vencimiento: fechaVencimiento || null,
        motivo: motivo.trim() || 'Compra de proveedor', // ✅ CAMBIADO: motivo en lugar de observaciones
      };

      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error al guardar compra:', error);

      let mensajeError = 'Error desconocido al guardar la compra.';
      if (typeof error === 'string') {
        mensajeError = error;
      } else if (error?.message) {
        mensajeError = error.message;
      } else if (error?.response?.data?.detail) {
        const detail = error.response.data.detail;
        mensajeError = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail;
      }

      alert(`Error del servidor: ${mensajeError}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title="Nueva Compra" onClose={onClose}>
      <BuscadorProductosAsync
        selectedProduct={productoSeleccionado}
        onChange={setProductoSeleccionado}
        onProductosBuscados={onProductosBuscados}
      />

      <SelectAlmacen almacenes={almacenes} value={almacenId} onChange={setAlmacenId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="input">
          <option value="">— Selecciona un proveedor —</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
        <input
          type="number"
          step="0.01"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="input"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Costo Unitario *</label>
        <input
          type="number"
          step="0.01"
          value={costoUnitario}
          onChange={(e) => setCostoUnitario(e.target.value)}
          className="input"
          placeholder="0.00"
        />
        <p className="text-xs text-gray-500 mt-1">Precio de compra al proveedor, no el precio de venta al cliente</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Número de Lote</label>
        <input
          type="text"
          value={numeroLote}
          onChange={(e) => setNumeroLote(e.target.value)}
          className="input"
          placeholder="Ej: L2024A001"
        />
        <p className="text-xs text-gray-500 mt-1">Opcional - Para trazabilidad del producto</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          className="input"
        />
        <p className="text-xs text-gray-500 mt-1">Opcional - Fecha límite de uso del producto</p>
      </div>

      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="input"
          rows="3"
          placeholder="Ej: Compra regular, reposición de stock, oferta especial..."
        />
        <p className="text-xs text-gray-500 mt-1">Opcional - Razón de la compra</p>
      </div>

      <button onClick={handleSubmit} disabled={guardando} className="btn btn-primary w-full py-3">
        {guardando ? 'Guardando...' : 'Guardar Compra'}
      </button>
    </Modal>
  );
}

// ============ MODAL: Ajuste de stock ============
function ModalAjuste({ productos, almacenes, onClose, onSave }) {
  const [productoSeleccionado, setProductoId] = useState('')
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.id || '')
  const [cantidad, setCantidad] = useState('')
  const [direccion, setDireccion] = useState('POSITIVO')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const producto = productos.find((p) => p.id === productoSeleccionado)
  const variante = producto?.variantes?.[0]

  const handleSubmit = async () => {
    if (!variante) { alert('Selecciona un producto'); return }
    if (!almacenId) { alert('Selecciona un almacén'); return }
    if (!cantidad || Number(cantidad) <= 0) { alert('Cantidad debe ser mayor a 0'); return }
    if (!motivo.trim()) { alert('El motivo es obligatorio para ajustes'); return }

    setGuardando(true)
    try {
      await onSave({
        variante_id: variante.id,
        almacen_id: almacenId,
        tipo: direccion === 'POSITIVO' ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
        cantidad: Number(cantidad),
        motivo: motivo.trim(),
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title="Ajuste de stock" onClose={onClose}>
      <BuscadorProductosAsync 
        selectedProduct={productos.find(p => p.id === productoSeleccionado) || null} 
        onChange={(producto) => setProductoId(producto ? producto.id : '')} 
      />
      <SelectAlmacen almacenes={almacenes} value={almacenId} onChange={setAlmacenId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de ajuste *</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDireccion('POSITIVO')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              direccion === 'POSITIVO' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'
            }`}
          >
            <TrendingUp className="w-5 h-5 mx-auto mb-1" />
            <span className="text-sm font-medium">Aumentar (+)</span>
          </button>
          <button
            type="button"
            onClick={() => setDireccion('NEGATIVO')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              direccion === 'NEGATIVO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200'
            }`}
          >
            <TrendingDown className="w-5 h-5 mx-auto mb-1" />
            <span className="text-sm font-medium">Disminuir (−)</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
        <input type="number" min="0" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="input" placeholder="5" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo * (obligatorio)</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" rows={2} placeholder="Ej: Conteo físico, producto dañado, error de captura..." />
      </div>

      <button onClick={handleSubmit} disabled={guardando} className="btn btn-primary w-full py-3">
        {guardando ? 'Registrando...' : 'Registrar ajuste'}
      </button>
    </Modal>
  )
}

// ============ MODAL: Devolución ============
function ModalDevolucion({ productos, almacenes, onClose, onSave }) {
  const [productoSeleccionado, setProductoId] = useState('')
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.id || '')
  const [cantidad, setCantidad] = useState('')
  const [origen, setOrigen] = useState('CLIENTE')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const producto = productos.find((p) => p.id === productoSeleccionado)
  const variante = producto?.variantes?.[0]

  const handleSubmit = async () => {
    if (!variante) { alert('Selecciona un producto'); return }
    if (!almacenId) { alert('Selecciona un almacén'); return }
    if (!cantidad || Number(cantidad) <= 0) { alert('Cantidad debe ser mayor a 0'); return }
    if (!motivo.trim()) { alert('El motivo es obligatorio'); return }

    setGuardando(true)
    try {
      await onSave({
        variante_id: variante.id,
        almacen_id: almacenId,
        tipo: origen === 'CLIENTE' ? 'DEVOLUCION_CLIENTE' : 'DEVOLUCION_PROVEEDOR',
        cantidad: Number(cantidad),
        motivo: motivo.trim(),
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title="Registrar devolución" onClose={onClose}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Origen *</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrigen('CLIENTE')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              origen === 'CLIENTE' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200'
            }`}
          >
            <span className="text-sm font-medium">Cliente devuelve</span>
            <p className="text-xs opacity-75">Stock aumenta</p>
          </button>
          <button
            type="button"
            onClick={() => setOrigen('PROVEEDOR')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              origen === 'PROVEEDOR' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'
            }`}
          >
            <span className="text-sm font-medium">A proveedor</span>
            <p className="text-xs opacity-75">Stock disminuye</p>
          </button>
        </div>
      </div>

      <BuscadorProductosAsync 
        selectedProduct={productos.find(p => p.id === productoSeleccionado) || null} 
        onChange={(producto) => setProductoId(producto ? producto.id : '')} 
      />
      <SelectAlmacen almacenes={almacenes} value={almacenId} onChange={setAlmacenId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
        <input type="number" min="0" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="input" placeholder="1" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" rows={2} placeholder="Producto defectuoso, cambio de talla, etc." />
      </div>

      <button onClick={handleSubmit} disabled={guardando} className="btn btn-primary w-full py-3">
        {guardando ? 'Registrando...' : 'Registrar devolución'}
      </button>
    </Modal>
  )
}

// ============ COMPONENTES COMUNES ============
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function SelectProducto({ productos, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">— Selecciona un producto —</option>
        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
    </div>
  )
}

function SelectAlmacen({ almacenes, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Almacén *</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">— Selecciona almacén —</option>
        {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
    </div>
  )
}