import { useState, useEffect } from 'react'
import { ventasApi } from '../services/api'
import { Receipt, Eye, XCircle, Calendar } from 'lucide-react'

export default function Ventas() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ventaDetalle, setVentaDetalle] = useState(null)

  useEffect(() => {
    loadVentas()
  }, [filtroEstado, fechaDesde, fechaHasta])

  const loadVentas = async () => {
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      if (fechaDesde) params.fecha_desde = fechaDesde
      if (fechaHasta) params.fecha_hasta = fechaHasta
      
      const data = await ventasApi.getVentas(params)
      setVentas(data.items || [])
    } catch (error) {
      console.error('Error loading ventas:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelarVenta = async (id) => {
    const motivo = prompt('Motivo de cancelación:')
    if (motivo === null) return
    
    try {
      await ventasApi.cancelarVenta(id, motivo)
      loadVentas()
      setVentaDetalle(null)
    } catch (error) {
      alert(error.message)
    }
  }

  const verDetalle = async (id) => {
    try {
      const venta = await ventasApi.getVenta(id)
      setVentaDetalle(venta)
    } catch (error) {
      alert(error.message)
    }
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
        <p className="text-gray-500">{ventas.length} ventas</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="input w-40"
        >
          <option value="">Todos los estados</option>
          <option value="COMPLETADA">Completadas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="CANCELADA">Canceladas</option>
        </select>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="input w-40"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="input w-40"
          />
        </div>
      </div>

      {/* Lista */}
      {ventas.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay ventas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ventas.map((venta) => (
            <div key={venta.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">#{venta.numero}</span>
                  <span className={`badge ${
                    venta.estado === 'COMPLETADA' ? 'bg-green-100 text-green-700' :
                    venta.estado === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {venta.estado}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {venta.cliente_nombre || 'Cliente mostrador'} • {formatFecha(venta.created_at)}
                </p>
                <p className="text-sm text-gray-500">
                  {venta.items_count} items • {venta.metodo_pago}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold text-primary-600">
                  Bs. {Number(venta.total).toFixed(2)}
                </span>
                <button
                  onClick={() => verDetalle(venta.id)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {ventaDetalle && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Ticket #{ventaDetalle.numero}</h2>
              <button onClick={() => setVentaDetalle(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estado</span>
                <span className={`badge ${
                  ventaDetalle.estado === 'COMPLETADA' ? 'bg-green-100 text-green-700' :
                  ventaDetalle.estado === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {ventaDetalle.estado}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cliente</span>
                <span>{ventaDetalle.cliente_nombre || 'Cliente mostrador'}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha</span>
                <span>{formatFecha(ventaDetalle.created_at)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Método de pago</span>
                <span>{ventaDetalle.metodo_pago}</span>
              </div>

              <hr />

              <div className="space-y-2">
                <p className="font-medium text-gray-900">Productos</p>
                {ventaDetalle.detalles?.map((detalle) => (
                  <div key={detalle.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                    <div>
                      <p className="font-medium">{detalle.producto_nombre}</p>
                      <p className="text-gray-500">
                        {Number(detalle.cantidad).toFixed(0)} x Bs. {Number(detalle.precio_unitario).toFixed(2)}
                      </p>
                    </div>
                    <span className="font-medium">Bs. {Number(detalle.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <hr />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Bs. {Number(ventaDetalle.subtotal).toFixed(2)}</span>
                </div>
                {Number(ventaDetalle.descuento) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento</span>
                    <span>-Bs. {Number(ventaDetalle.descuento).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary-600">Bs. {Number(ventaDetalle.total).toFixed(2)}</span>
                </div>
                {ventaDetalle.cambio > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Cambio</span>
                    <span>Bs. {Number(ventaDetalle.cambio).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {ventaDetalle.estado === 'COMPLETADA' && (
                <button
                  onClick={() => cancelarVenta(ventaDetalle.id)}
                  className="btn btn-danger w-full"
                >
                  Cancelar venta
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
