import React from "react";
import useUtilidadPorProducto from "../hooks/useUtilidadPorProducto";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { useReportesStore } from "../store/useReportesStore";

// Función auxiliar para truncar nombres largos en el eje Y
const truncarTexto = (texto, limite = 15) => {
  return texto.length > limite ? `${texto.substring(0, limite)}...` : texto;
};

export default function RendimientoProductos() {
  const { fechaDesde, fechaHasta } = useReportesStore();
  
  // Consumimos el estado del servidor a través de TanStack Query
  const { data, isLoading, isError } = useUtilidadPorProducto(fechaDesde, fechaHasta);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="h-80 bg-gray-200 rounded-lg animate-pulse shadow-sm"></div>
        <div className="h-80 bg-gray-200 rounded-lg animate-pulse shadow-sm"></div>
      </div>
    );
  }

  if (isError || !data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Gráfico 1: Motores de Rentabilidad */}
      <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">🏆 Motores de Rentabilidad</h3>
          <p className="text-xs text-gray-500">Top de productos con mayor utilidad neta absoluta</p>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          {data.top_rentables.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              No hay registros de ventas en este periodo.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart layout="vertical" data={data.top_rentables} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={(v) => `Bs${v}`} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis 
                  dataKey="producto_nombre" 
                  type="category" 
                  width={110} 
                  tickFormatter={(v) => truncarTexto(v, 14)}
                  tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }} 
                />
                <Tooltip 
                  formatter={(val, name, props) => [`Bs. ${val}`, `Margen: ${props.payload.margin}%`]}
                  contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={25} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico 2: Fugas de Capital */}
      <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">⚠️ Fugas de Capital</h3>
          <p className="text-xs text-gray-500">Productos con rendimiento e ingresos negativos</p>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          {data.top_perdidas.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 bg-green-50 border border-green-100 rounded-lg">
              <span className="text-2xl mb-1">🎉</span>
              <p className="text-sm font-semibold text-green-800">Operación Eficiente</p>
              <p className="text-xs text-green-600 max-w-xs">Todos los productos físicos mantuvieron márgenes positivos en este rango temporal.</p>
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart layout="vertical" data={data.top_perdidas} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={(v) => `Bs${v}`} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis 
                  dataKey="producto_nombre" 
                  type="category" 
                  width={110} 
                  tickFormatter={(v) => truncarTexto(v, 14)}
                  tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }} 
                />
                <Tooltip 
                  formatter={(val) => [`Bs. ${val}`, 'Pérdida Absoluta']}
                  contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="profit" fill="#ef4444" radius={[4, 0, 0, 4]} maxBarSize={25} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}