import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ventasApi, pagosApi } from '../services/api'
import { Receipt, Eye, XCircle, Calendar, CheckCircle2, AlertTriangle, Clock, Banknote, QrCode, CreditCard } from 'lucide-react'

export default function Ventas() {
  const navigate = useNavigate()
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
    const motivo = prompt('Motivo de cancelación de la venta:')
    if (motivo === null) return
    if (!motivo.trim()) {
      alert('Debe especificar un motivo para la anulación transaccional.')
      return
    }

    const devolverEfectivo = confirm(
      '¿Desea registrar la devolución física de efectivo de la gaveta de caja?\n\n' +
      '[Aceptar] = Sí, reintegrar dinero físico al cliente\n' +
      '[Cancelar] = No, solo reversión contable/cartera'
    )
    
    try {
      await ventasApi.cancelarVenta(id, { motivo: motivo.trim(), devolver_efectivo: devolverEfectivo })
      alert('Venta cancelada exitosamente con reingreso de existencias e invalidación de cartera.')
      loadVentas()
      setVentaDetalle(null)
    } catch (error) {
      alert(error.message || 'Error al cancelar la venta')
    }
  }

  const confirmarPagoVenta = async (pagoId, ventaId) => {
    if (!confirm('¿Confirma que este cobro (QR / Transferencia) fue acreditado y verificado en cuenta?')) {
      return
    }
    try {
      await pagosApi.confirmarPago(pagoId, { notas: 'Verificación en ventanilla' })
      alert('Pago verificado y confirmado exitosamente.')
      verDetalle(ventaId)
      loadVentas()
    } catch (error) {
      alert(error.message || 'Error al confirmar el cobro')
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

  const formatFecha = (fechaOriginal) => {
    if (!fechaOriginal) return '';
  
    // Forzar el formato UTC si viene como string
    const fechaSegura = typeof fechaOriginal === 'string' && !fechaOriginal.endsWith('Z') 
      ? `${fechaOriginal}Z` 
      : fechaOriginal;
    
    return new Date(fechaSegura).toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">#{venta.numero}</span>
                  <span className={`badge text-xs ${
                    venta.estado === 'COMPLETADA' ? 'bg-green-100 text-green-700' :
                    venta.estado === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {venta.estado}
                  </span>
                  {venta.estado !== 'CANCELADA' && (
                    <span className={`badge text-xs ${
                      venta.estado_financiero === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                      venta.estado_financiero === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                      venta.estado_financiero === 'PENDING' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {venta.estado_financiero === 'PAID' ? 'Cobrado' :
                       venta.estado_financiero === 'PARTIAL' ? 'Parcial' :
                       venta.estado_financiero === 'PENDING' ? 'Por Cobrar / Pend.' :
                       'Sin aplicar'}
                    </span>
                  )}
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

              {/* Desglose Financiero de Pagos */}
              {ventaDetalle.pagos && ventaDetalle.pagos.length > 0 && (
                <>
                  <hr />
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900 text-xs uppercase tracking-wide">Cobros Registrados</p>
                    <div className="space-y-1.5">
                      {ventaDetalle.pagos.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-200">
                          <div>
                            <span className="font-semibold text-gray-800">{p.metodo_pago}</span>
                            <span className="text-gray-500 ml-2">Bs. {Number(p.monto).toFixed(2)}</span>
                            {p.referencia && <span className="text-gray-400 ml-1">({p.referencia})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge text-[10px] ${
                              p.estado === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                              p.estado === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {p.estado === 'CONFIRMED' ? 'Confirmado' : p.estado === 'PENDING' ? 'En espera' : p.estado}
                            </span>
                            {p.estado === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => confirmarPagoVenta(p.id, ventaDetalle.id)}
                                className="btn btn-xs bg-emerald-600 text-white hover:bg-emerald-700 px-2 py-0.5 rounded text-[11px]"
                              >
                                Confirmar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Cuenta por cobrar si existe */}
              {ventaDetalle.cuenta_por_cobrar && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-semibold text-sm">Cartera / Crédito pendiente</p>
                    <p className="text-[11px] text-amber-700">Vence: {ventaDetalle.cuenta_por_cobrar.fecha_vencimiento || 'Sin fecha'}</p>
                    <p className="text-xs font-bold text-amber-900 mt-0.5">
                      Saldo Deuda: Bs. {Number(ventaDetalle.cuenta_por_cobrar.saldo_pendiente).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {Number(ventaDetalle.cuenta_por_cobrar.saldo_pendiente) > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVentaDetalle(null)
                          navigate('/cartera', { state: { ticket: ventaDetalle.numero } })
                        }}
                        className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm px-3 py-1.5 rounded-lg text-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Abonar
                      </button>
                    ) : (
                      <span className="badge bg-emerald-100 text-emerald-800 font-semibold px-2 py-1 rounded">
                        Liquidada
                      </span>
                    )}
                  </div>
                </div>
              )}

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
