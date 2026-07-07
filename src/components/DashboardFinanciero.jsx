import React, { useState, useEffect } from "react";
import useUtilidadPeriodo from "../hooks/useUtilidadPeriodo";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ResponsiveContainer, 
  Legend,
  ReferenceLine 
} from "recharts";
import RendimientoProductos from "./RendimientoProductos";
import { useReportesStore } from "../store/useReportesStore";

// Utilidad pura: Extrae la fecha en la zona horaria del dispositivo, ignorando UTC
const obtenerFechaLocalStr = (fecha = new Date()) => {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Genera un rango inicial inofensivo (del día 1 del mes actual, al día de hoy)
const getRangoPorDefecto = () => {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return {
    desde: obtenerFechaLocalStr(inicioMes),
    hasta: obtenerFechaLocalStr(hoy)
  };
};

export default function DashboardFinanciero() {
  // 1. Conexión a Zustand (Estado Global)
  const { fechaDesde, fechaHasta, setRangoFechas } = useReportesStore();

  // 2. Conexión al Borrador Local (Compuerta temporal)
  const [draftFechas, setDraftFechas] = useState({ desde: fechaDesde, hasta: fechaHasta });
  
  // Sincroniza el borrador si el estado global cambia desde otro componente
  useEffect(() => {
    setDraftFechas({ desde: fechaDesde, hasta: fechaHasta });
  }, [fechaDesde, fechaHasta]);

  // 3. Conexión a TanStack Query (Estado del Servidor)
  const { data, isLoading, isError, error, isFetching } = useUtilidadPeriodo(fechaDesde, fechaHasta);

  // La Compuerta estricta
  const ejecutarFiltro = (e) => {
    e.preventDefault();
    if (new Date(draftFechas.desde) > new Date(draftFechas.hasta)) {
      alert("Operación denegada: La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    // Empuja al store global. Esto muta la key del hook y dispara TanStack Query.
    setRangoFechas(draftFechas.desde, draftFechas.hasta);
  };

  if (isError) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-800 rounded">
          <strong>Fallo Crítico en la Red: </strong> {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            Cierre Financiero (FEFO)
            {/* Indicador sutil de fondo (Background Fetching) de React Query */}
            {isFetching && !isLoading && (
               <span className="text-xs font-normal px-2 py-1 bg-blue-100 text-blue-700 rounded-full animate-pulse">
                 Sincronizando...
               </span>
            )}
          </h1>
          <p className="text-gray-500">Mostrando resultados consolidados</p>
        </div>

        <form onSubmit={ejecutarFiltro} className="mt-4 md:mt-0 flex items-end gap-3 bg-white p-3 rounded-lg shadow border border-gray-200">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Desde</label>
            <input 
              type="date" 
              value={draftFechas.desde}
              max={draftFechas.hasta} // UX: Limita visualmente saltos erráticos
              onChange={(e) => setDraftFechas({...draftFechas, desde: e.target.value})}
              className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Hasta</label>
            <input 
              type="date" 
              value={draftFechas.hasta}
              max={obtenerFechaLocalStr()} // UX: No permite seleccionar días en el futuro
              onChange={(e) => setDraftFechas({...draftFechas, hasta: e.target.value})}
              className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              required
            />
          </div>
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-4 rounded transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Calculando...' : 'Aplicar'}
          </button>
        </form>
      </div>

      {isLoading ? (
        // Skeleton Loaders para experiencia premium mientras se resuelve TanStack Query
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-pulse">
           {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg shadow"></div>)}
        </div>
      ) : data ? (
        <>
          {/* Tarjetas de Resumen Gerencial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500 uppercase font-semibold">Ingreso Total (Caja)</p>
              <p className="text-3xl font-bold text-gray-800">Bs. {data.revenue}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500 uppercase font-semibold">Utilidad Pura (FEFO)</p>
              <p className={`text-3xl font-bold ${parseFloat(data.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Bs. {data.profit}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500 uppercase font-semibold">Margen Neto</p>
              <p className={`text-3xl font-bold ${parseFloat(data.margin) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {data.margin}%
              </p>
            </div>
          </div>

          {/* Alerta de Datos Corruptos (Legacy) */}
          {data.ventas_legacy_excluidas?.count > 0 && (
            <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded shadow-sm">
              <strong>⚠️ Alerta de Inventario: </strong> 
              Se excluyeron {data.ventas_legacy_excluidas.count} ventas (Bs. {data.ventas_legacy_excluidas.revenue_excluido}) 
              del cálculo de utilidad por falta de trazabilidad en los almacenes.
            </div>
          )}

          {/* Gráfico de Tendencias Compuesto */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Comportamiento Diario</h2>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <ComposedChart data={data.por_periodo} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  
                  <XAxis 
                    dataKey="fecha" 
                    tickFormatter={(tickItem) => {
                      const [y, m, d] = tickItem.split('-');
                      return `${d}/${m}`;
                    }}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  
                  <YAxis 
                    tickFormatter={(value) => `Bs${value}`} 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  
                  <Tooltip 
                    formatter={(value, name) => [`Bs. ${parseFloat(value).toFixed(2)}`, name]}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  
                  <Legend wrapperStyle={{ paddingTop: '20px' }}/>

                  {/* La línea del Cero: Crítica para separar ganancias de pérdidas visualmente */}
                  <ReferenceLine y={0} stroke="#374151" strokeWidth={1.5} opacity={0.5} />

                  {/* 1ra Capa (Fondo): Barras de Utilidad con renderizado condicional de color */}
                  <Bar 
                     dataKey="profit" 
                     name="Utilidad Neta" 
                     fill="#10b981" 
                     maxBarSize={40} 
                     radius={[4, 4, 0, 0]}
>
                    {data.por_periodo.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} // Verde para ganancia, Rojo para pérdida
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>

                  {/* 2da Capa (Frente): Línea de Ingreso Bruto para ver volumen de ventas */}
                 <Line 
                     type="monotone"
                     dataKey="revenue" 
                     name="Ingreso Bruto" 
                     stroke="#3b82f6" 
                     activeDot={{ r: 8 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* INYECCIÓN DE LA RUTA A: Inteligencia por Producto */}
          <RendimientoProductos />
        </>
      ) : null}
    </div>
  );
}