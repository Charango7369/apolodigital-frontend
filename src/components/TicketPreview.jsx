import { Printer, X, CheckCircle } from 'lucide-react';
import { imprimirTicket } from '../services/ticketService';

/**
 * Modal de vista previa y impresión de ticket
 */
export default function TicketPreview({ venta, onClose, configNegocio }) {
  if (!venta) return null;

  const config = configNegocio || {
    nombre: 'ApoloDigital',
    direccion: 'Apolo, La Paz - Bolivia',
    telefono: '',
    nit: '',
    mensaje_pie: '¡Gracias por su compra!',
  };

  const items = venta.detalles || venta.items || [];
  const fecha = new Date(venta.created_at || new Date());

  const handlePrint = () => {
    imprimirTicket(venta, config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-green-50">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Venta Completada</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-green-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Ticket Preview */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-sm shadow-inner">
            {/* Header del ticket */}
            <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
              <h2 className="font-bold text-lg">{config.nombre}</h2>
              <p className="text-xs text-gray-600">{config.direccion}</p>
              {config.telefono && (
                <p className="text-xs text-gray-600">Tel: {config.telefono}</p>
              )}
            </div>

            {venta.offline && (
              <div className="bg-yellow-100 text-yellow-800 text-xs text-center py-1 mb-3 rounded">
                VENTA OFFLINE - PENDIENTE SYNC
              </div>
            )}

            {/* Info de la venta */}
            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between">
                <span>Ticket:</span>
                <span className="font-semibold">#{venta.numero || venta.temp_id}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha:</span>
                <span>{fecha.toLocaleDateString('es-BO')} {fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span>{venta.cliente_nombre || 'Mostrador'}</span>
              </div>
              {venta.cliente_nit && (
                <div className="flex justify-between">
                  <span>NIT:</span>
                  <span>{venta.cliente_nit}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {/* Items */}
            <div className="space-y-2 mb-3">
              {items.map((item, index) => (
                <div key={index}>
                  <div className="text-xs font-medium truncate">
                    {item.producto_nombre || item.nombre}
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 pl-2">
                    <span>{item.cantidad} x Bs. {Number(item.precio_unitario || item.precio).toFixed(2)}</span>
                    <span>Bs. {Number(item.subtotal || (item.cantidad * (item.precio_unitario || item.precio))).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {/* Totales */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Subtotal:</span>
                <span>Bs. {Number(venta.subtotal || venta.total).toFixed(2)}</span>
              </div>
              {venta.descuento > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Descuento:</span>
                  <span>-Bs. {Number(venta.descuento).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>TOTAL:</span>
                <span>Bs. {Number(venta.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span>Método:</span>
                <span>{formatMetodoPago(venta.metodo_pago)}</span>
              </div>
              {venta.cambio > 0 && (
                <div className="flex justify-between text-xs text-green-600 pt-1">
                  <span>Cambio:</span>
                  <span>Bs. {Number(venta.cambio).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            {/* Footer */}
            <div className="text-center text-xs text-gray-600">
              <p>{config.mensaje_pie}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 space-y-2">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            <Printer className="w-5 h-5" />
            Imprimir Ticket
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMetodoPago(metodo) {
  const metodos = {
    'EFECTIVO': 'Efectivo',
    'QR': 'QR',
    'TARJETA': 'Tarjeta',
    'TRANSFERENCIA': 'Transferencia',
    'CREDITO': 'Crédito',
    'MIXTO': 'Mixto',
  };
  return metodos[metodo] || metodo;
}
