import { useState } from 'react' // <--- IMPORTANTE: Importar useState
import useStockActual from '../hooks/useStockActual'
import useAlmacenes from '../hooks/useAlmacenes'
import useCategorias from '../hooks/useCategorias'
import { Package, DollarSign, AlertCircle } from 'lucide-react'

export default function ReporteStockActual() {
  const [filtros, setFiltros] = useState({ almacen_id: '', categoria_id: '' })
  
  const { data: stock, isLoading, isError } = useStockActual(filtros)
  const { data: almacenes } = useAlmacenes()
  const { data: categorias } = useCategorias()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3">
        <AlertCircle className="w-6 h-6" />
        <p>Error de red al cargar el reporte de stock. Verifica tu conexión o el backend.</p>
      </div>
    )
  }

  const stockList = Array.isArray(stock) ? stock : (stock?.items || [])

  const totalUnidades = stockList.reduce((acc, item) => acc + Number(item.cantidad_actual || 0), 0)
  const capitalTotal = stockList.reduce((acc, item) => {
    const cantidad = Number(item.cantidad_actual || 0)
    const costo = Number(item.costo_unitario || 0)
    return acc + (cantidad * costo)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Actual Consolidado</h1>
          <p className="text-gray-500">Valorización de inventario en tiempo real</p>
        </div>
      </div>

      {/* FILTROS INTEGRADOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <select 
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          value={filtros.almacen_id}
          onChange={(e) => setFiltros({...filtros, almacen_id: e.target.value})}
        >
          <option value="">Todos los almacenes</option>
          {almacenes?.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        
        <select 
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          value={filtros.categoria_id}
          onChange={(e) => setFiltros({...filtros, categoria_id: e.target.value})}
        >
          <option value="">Todas las categorías</option>
          {categorias?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="p-3 rounded-lg bg-blue-100 text-blue-700">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Unidades Físicas</p>
            <p className="text-2xl font-bold text-gray-900">{totalUnidades.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="card flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-700">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Capital Valorizado (Costo)</p>
            <p className="text-2xl font-bold text-gray-900">Bs. {capitalTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Código/SKU</th>
                <th className="px-6 py-3">Producto</th>
                <th className="px-6 py-3 text-right">Cant. Actual</th>
                <th className="px-6 py-3 text-right">Costo Unit.</th>
                <th className="px-6 py-3 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {stockList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No hay datos disponibles.</td>
                </tr>
              ) : (
                stockList.map((item, index) => {
                  const cantidad = Number(item.cantidad_actual || 0)
                  const costo = Number(item.costo_unitario || 0)
                  const valorTotal = cantidad * costo
                  return (
                    <tr key={item.variante_id || index} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4">{item.sku || '-'}</td>
                      <td className="px-6 py-4">
                        {item.producto_nombre}
                        <span className="block text-xs text-gray-400">{item.almacen_nombre}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{cantidad}</td>
                      <td className="px-6 py-4 text-right">Bs. {costo.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">Bs. {valorTotal.toFixed(2)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}