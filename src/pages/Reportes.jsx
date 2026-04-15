import { useState, useEffect } from 'react'
import { ventasApi } from '../services/api'
import { BarChart3, Calendar, TrendingUp, DollarSign, Receipt, CreditCard } from 'lucide-react'

export default function Reportes() {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [reporteVentas, setReporteVentas] = useState(null)
  const [reporteCaja, setReporteCaja] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportes()
  }, [fecha])

  const loadReportes = async () => {
    setLoading(true)
    try {
      const [ventas, caja] = await Promise.all([
        ventasApi.getReporteVentasDia(fecha),
        ventasApi.getReporteCaja(fecha)
      ])
      setReporteVentas(ventas)
      setReporteCaja(caja)
    } catch (error) {
      console.error('Error loading reportes:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (value) => `Bs. ${Number(value || 0).toFixed(2)}`

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
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500">Resumen de ventas y caja</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="input w-40"
          />
        </div>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ventas</p>
              <p className="text-2xl font-bold text-gray-900">
                {reporteVentas?.total_ventas || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total vendido</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatMoney(reporteCaja?.total_general)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ticket promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatMoney(reporteVentas?.ticket_promedio)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-500">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Canceladas</p>
              <p className="text-2xl font-bold text-gray-900">
                {reporteCaja?.ventas_canceladas || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Desglose por método de pago */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Desglose por método de pago
        </h2>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Efectivo', value: reporteCaja?.total_efectivo, color: 'bg-green-100 text-green-700', icon: '💵' },
            { label: 'QR', value: reporteCaja?.total_qr, color: 'bg-blue-100 text-blue-700', icon: '📱' },
            { label: 'Tarjeta', value: reporteCaja?.total_tarjeta, color: 'bg-purple-100 text-purple-700', icon: '💳' },
            { label: 'Transferencia', value: reporteCaja?.total_transferencia, color: 'bg-yellow-100 text-yellow-700', icon: '🏦' },
            { label: 'Crédito', value: reporteCaja?.total_credito, color: 'bg-red-100 text-red-700', icon: '📝' },
          ].map((item) => (
            <div key={item.label} className={`p-4 rounded-xl ${item.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              <p className="text-2xl font-bold">{formatMoney(item.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico simple de métodos */}
      {reporteCaja && Number(reporteCaja.total_general) > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución de pagos
          </h2>
          
          <div className="space-y-3">
            {[
              { label: 'Efectivo', value: reporteCaja.total_efectivo, color: 'bg-green-500' },
              { label: 'QR', value: reporteCaja.total_qr, color: 'bg-blue-500' },
              { label: 'Tarjeta', value: reporteCaja.total_tarjeta, color: 'bg-purple-500' },
              { label: 'Transferencia', value: reporteCaja.total_transferencia, color: 'bg-yellow-500' },
              { label: 'Crédito', value: reporteCaja.total_credito, color: 'bg-red-500' },
            ].filter(item => Number(item.value) > 0).map((item) => {
              const porcentaje = (Number(item.value) / Number(reporteCaja.total_general)) * 100
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-gray-500">{porcentaje.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all duration-500`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sin datos */}
      {(!reporteVentas || reporteVentas.total_ventas === 0) && (
        <div className="card text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay ventas para esta fecha</p>
        </div>
      )}
    </div>
  )
}
