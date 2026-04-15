import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ventasApi, inventarioApi } from '../services/api'
import {
  TrendingUp,
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Receipt
} from 'lucide-react'

export default function Dashboard() {
  const [reporteCaja, setReporteCaja] = useState(null)
  const [alertasStock, setAlertasStock] = useState([])
  const [ultimasVentas, setUltimasVentas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [caja, alertas, ventas] = await Promise.all([
        ventasApi.getReporteCaja(),
        inventarioApi.getAlertasStock(),
        ventasApi.getVentas({ per_page: 5 })
      ])
      setReporteCaja(caja)
      setAlertasStock(alertas)
      setUltimasVentas(ventas.items || [])
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const stats = [
    {
      name: 'Ventas del día',
      value: reporteCaja?.ventas_completadas || 0,
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      name: 'Total vendido',
      value: `Bs. ${Number(reporteCaja?.total_general || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      name: 'Efectivo',
      value: `Bs. ${Number(reporteCaja?.total_efectivo || 0).toFixed(2)}`,
      icon: Receipt,
      color: 'bg-yellow-500',
    },
    {
      name: 'Alertas stock',
      value: alertasStock.length,
      icon: AlertTriangle,
      color: alertasStock.length > 0 ? 'bg-red-500' : 'bg-gray-400',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Resumen del día</p>
        </div>
        <Link to="/pos" className="btn btn-primary flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Nueva venta
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimas ventas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Últimas ventas</h2>
            <Link to="/ventas" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {ultimasVentas.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay ventas hoy</p>
          ) : (
            <div className="space-y-3">
              {ultimasVentas.map((venta) => (
                <div key={venta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Ticket #{venta.numero}</p>
                    <p className="text-sm text-gray-500">{venta.cliente_nombre || 'Cliente mostrador'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">Bs. {Number(venta.total).toFixed(2)}</p>
                    <span className={`badge ${
                      venta.estado === 'COMPLETADA' ? 'bg-green-100 text-green-700' :
                      venta.estado === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {venta.estado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas de stock */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Alertas de stock</h2>
            <Link to="/productos" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver productos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {alertasStock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Sin alertas de stock bajo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertasStock.slice(0, 5).map((alerta) => (
                <div key={alerta.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <p className="font-medium text-gray-900">{alerta.producto_nombre}</p>
                    <p className="text-sm text-gray-500">{alerta.almacen_nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{Number(alerta.cantidad_actual).toFixed(0)} uds</p>
                    <p className="text-xs text-gray-500">Mín: {Number(alerta.cantidad_minima).toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumen por método de pago */}
      {reporteCaja && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de caja</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Efectivo', value: reporteCaja.total_efectivo },
              { label: 'QR', value: reporteCaja.total_qr },
              { label: 'Tarjeta', value: reporteCaja.total_tarjeta },
              { label: 'Transferencia', value: reporteCaja.total_transferencia },
              { label: 'Crédito', value: reporteCaja.total_credito },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-lg font-bold text-gray-900">Bs. {Number(item.value || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
