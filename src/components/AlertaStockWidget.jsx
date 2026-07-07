import useAlertasStock from '../hooks/useAlertasStock';
import { AlertTriangle } from 'lucide-react';

export default function AlertaStockWidget() {
  const { data: alertas, isLoading } = useAlertasStock();

  if (isLoading) return <div className="p-4 animate-pulse bg-gray-100 rounded-lg">Cargando alertas...</div>;
  if (!alertas || alertas.length === 0) return <div className="p-4 text-gray-500">No hay alertas activas de inventario.</div>;


  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-amber-600 w-6 h-6" />
        <div>
          <h3 className="font-bold text-amber-900">Alerta de Inventario</h3>
          <p className="text-sm text-amber-700">
            Tienes <span className="font-bold">{alertas.length} productos</span> por debajo del stock mínimo.
          </p>
        </div>
      </div>
    </div>
  );
}