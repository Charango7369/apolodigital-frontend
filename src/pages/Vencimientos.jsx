import { useState, useEffect } from 'react'
import { inventarioApi } from '../services/api'
import { AlertTriangle, RefreshCw, Filter, Search, Calendar } from 'lucide-react'

const NIVELES = {
  VENCIDO: { label: 'Vencidos',     badge: 'bg-gray-900 text-white',         border: 'border-gray-900',  text: 'text-gray-900',  bg: 'bg-gray-50'  },
  CRITICO: { label: '< 1 mes',      badge: 'bg-red-100 text-red-700',         border: 'border-red-500',    text: 'text-red-700',    bg: 'bg-red-50'   },
  URGENTE: { label: '1 a 3 meses',  badge: 'bg-orange-100 text-orange-700',   border: 'border-orange-500', text: 'text-orange-700', bg: 'bg-orange-50'},
  ALERTA:  { label: '3 a 6 meses',  badge: 'bg-yellow-100 text-yellow-700',   border: 'border-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50'},
}

function clasificar(dias) {
  if (dias < 0) return 'VENCIDO'
  if (dias < 30) return 'CRITICO'
  if (dias < 90) return 'URGENTE'
  return 'ALERTA'
}

function formatDias(d) {
  if (d < 0) return `Vencido hace ${Math.abs(d)}d`
  if (d === 0) return 'Vence hoy'
  return `En ${d}d`
}

function formatFecha(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric' })
}

export default function Vencimientos() {
  const [lotes, setLotes] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [fAlmacen, setFAlmacen] = useState('')
  const [fNivel, setFNivel] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const [l, a] = await Promise.all([
        inventarioApi.getLotesProximosVencer(180),
        inventarioApi.getAlmacenes(),
      ])
      setLotes(l || [])
      setAlmacenes(a || [])
    } catch (e) {
      console.error('Error cargando vencimientos:', e)
    } finally { setLoading(false) }
  }

  const conteo = lotes.reduce((acc, l) => {
    const n = clasificar(l.dias_para_vencer)
    acc[n] = (acc[n] || 0) + 1
    return acc
  }, {})

  const filtrados = lotes
    .filter((l) => {
      if (fAlmacen && l.almacen_id !== fAlmacen) return false
      if (fNivel && clasificar(l.dias_para_vencer) !== fNivel) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const m =
          l.producto_nombre?.toLowerCase().includes(q) ||
          l.codigo_lote?.toLowerCase().includes(q) ||
          l.variante_sku?.toLowerCase().includes(q)
        if (!m) return false
      }
      return true
    })
    .sort((a, b) => a.dias_para_vencer - b.dias_para_vencer)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vencimientos</h1>
          <p className="text-sm text-gray-500">Lotes con stock que vencen en los próximos 6 meses</p>
        </div>
        <button onClick={cargar} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(NIVELES).map(([key, n]) => {
          const count = conteo[key] || 0
          const active = fNivel === key
          return (
            <button
              key={key}
              onClick={() => setFNivel(active ? '' : key)}
              className={`card p-4 text-left border-2 transition-all hover:shadow-md ${active ? n.border : 'border-transparent'} ${active ? n.bg : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${n.text}`} />
                <p className={`text-sm font-medium ${n.text}`}>{n.label}</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{count === 1 ? 'lote' : 'lotes'}</p>
            </button>
          )
        })}
      </div>

      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <select value={fAlmacen} onChange={(e) => setFAlmacen(e.target.value)} className="input max-w-xs">
          <option value="">Todos los almacenes</option>
          {almacenes.map((a) => (<option key={a.id} value={a.id}>{a.nombre}</option>))}
        </select>
        <div className="flex-1 relative min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto, lote o SKU..."
            className="input pl-10"
          />
        </div>
        {(fNivel || fAlmacen || busqueda) && (
          <button
            onClick={() => { setFNivel(''); setFAlmacen(''); setBusqueda('') }}
            className="btn btn-secondary text-sm"
          >Limpiar filtros</button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {lotes.length === 0
                ? 'No hay lotes próximos a vencer en los próximos 6 meses'
                : 'No hay resultados con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Producto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Lote</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Almacén</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Vence</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Días</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Cantidad</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const nivel = NIVELES[clasificar(l.dias_para_vencer)]
                  return (
                    <tr key={l.id} className={`border-b hover:bg-gray-50 ${nivel.bg}`}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{l.producto_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{l.codigo_lote || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{l.almacen_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{formatFecha(l.fecha_vencimiento)}</td>
                      <td className={`px-4 py-3 text-center font-medium ${nivel.text}`}>{formatDias(l.dias_para_vencer)}</td>
                      <td className="px-4 py-3 text-right font-medium">{Number(l.cantidad_actual).toFixed(0)}</td>
                      <td className="px-4 py-3"><span className={`badge ${nivel.badge}`}>{nivel.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
