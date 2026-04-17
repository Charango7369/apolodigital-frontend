/**
 * Servicio de impresión de tickets
 * Compatible con impresoras térmicas de 58mm (32 caracteres por línea)
 */

// Configuración del negocio (se puede hacer dinámico después)
const CONFIG_NEGOCIO = {
  nombre: 'ApoloDigital',
  direccion: 'Apolo, La Paz - Bolivia',
  telefono: '',
  nit: '',
  mensaje_pie: '¡Gracias por su compra!',
};

/**
 * Genera el HTML del ticket para imprimir
 */
export function generarTicketHTML(venta, config = CONFIG_NEGOCIO) {
  const fecha = new Date(venta.created_at || new Date());
  const fechaStr = fecha.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const horaStr = fecha.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const items = venta.detalles || venta.items || [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket #${venta.numero || 'OFFLINE'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: 58mm auto;
      margin: 0;
    }
    
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 58mm;
      padding: 2mm;
      line-height: 1.3;
    }
    
    .ticket {
      width: 100%;
    }
    
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    
    .header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .header p {
      font-size: 10px;
    }
    
    .info {
      margin-bottom: 8px;
      font-size: 11px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
    }
    
    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    
    .items {
      margin-bottom: 8px;
    }
    
    .item {
      margin-bottom: 4px;
    }
    
    .item-name {
      font-size: 11px;
    }
    
    .item-details {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      padding-left: 8px;
    }
    
    .totals {
      border-top: 1px dashed #000;
      padding-top: 8px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    
    .total-row.final {
      font-size: 14px;
      font-weight: bold;
      margin-top: 4px;
    }
    
    .footer {
      text-align: center;
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 10px;
    }
    
    .footer p {
      margin-bottom: 2px;
    }
    
    .offline-badge {
      background: #ffc107;
      color: #000;
      padding: 2px 6px;
      font-size: 9px;
      text-align: center;
      margin-bottom: 4px;
    }
    
    @media print {
      body {
        width: 58mm;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <!-- Header -->
    <div class="header">
      <h1>${config.nombre}</h1>
      <p>${config.direccion}</p>
      ${config.telefono ? `<p>Tel: ${config.telefono}</p>` : ''}
      ${config.nit ? `<p>NIT: ${config.nit}</p>` : ''}
    </div>
    
    ${venta.offline ? '<div class="offline-badge">VENTA OFFLINE - PENDIENTE SYNC</div>' : ''}
    
    <!-- Info de la venta -->
    <div class="info">
      <div class="info-row">
        <span>Ticket:</span>
        <span>#${venta.numero || venta.temp_id || '---'}</span>
      </div>
      <div class="info-row">
        <span>Fecha:</span>
        <span>${fechaStr} ${horaStr}</span>
      </div>
      <div class="info-row">
        <span>Cliente:</span>
        <span>${venta.cliente_nombre || 'Mostrador'}</span>
      </div>
      ${venta.cliente_nit ? `
      <div class="info-row">
        <span>NIT:</span>
        <span>${venta.cliente_nit}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span>Atendió:</span>
        <span>${venta.vendedor_nombre || 'Admin'}</span>
      </div>
    </div>
    
    <div class="divider"></div>
    
    <!-- Items -->
    <div class="items">
      ${items.map(item => `
        <div class="item">
          <div class="item-name">${item.producto_nombre || item.nombre}</div>
          <div class="item-details">
            <span>${item.cantidad} x Bs. ${Number(item.precio_unitario || item.precio).toFixed(2)}</span>
            <span>Bs. ${Number(item.subtotal || (item.cantidad * (item.precio_unitario || item.precio))).toFixed(2)}</span>
          </div>
        </div>
      `).join('')}
    </div>
    
    <!-- Totales -->
    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>Bs. ${Number(venta.subtotal || venta.total).toFixed(2)}</span>
      </div>
      ${venta.descuento > 0 ? `
      <div class="total-row">
        <span>Descuento:</span>
        <span>-Bs. ${Number(venta.descuento).toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="total-row final">
        <span>TOTAL:</span>
        <span>Bs. ${Number(venta.total).toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>Método:</span>
        <span>${formatMetodoPago(venta.metodo_pago)}</span>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>${config.mensaje_pie}</p>
      <p>- - - - - - - - - - - - - -</p>
      <p style="font-size: 8px;">Impreso: ${new Date().toLocaleString('es-BO')}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
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

/**
 * Imprime el ticket abriendo una ventana de impresión
 */
export function imprimirTicket(venta, config = CONFIG_NEGOCIO) {
  const html = generarTicketHTML(venta, config);
  
  const ventanaImpresion = window.open('', '_blank', 'width=300,height=600');
  
  if (!ventanaImpresion) {
    alert('Por favor permite las ventanas emergentes para imprimir');
    return false;
  }
  
  ventanaImpresion.document.write(html);
  ventanaImpresion.document.close();
  
  // Esperar a que cargue y luego imprimir
  ventanaImpresion.onload = () => {
    setTimeout(() => {
      ventanaImpresion.print();
      // Cerrar después de imprimir (opcional)
      // ventanaImpresion.close();
    }, 250);
  };
  
  return true;
}

/**
 * Genera ticket en formato texto plano (para impresoras ESC/POS)
 */
export function generarTicketTexto(venta, config = CONFIG_NEGOCIO) {
  const ANCHO = 32; // caracteres por línea en 58mm
  const linea = '='.repeat(ANCHO);
  const lineaPunteada = '-'.repeat(ANCHO);
  
  const centrar = (texto) => {
    const espacios = Math.max(0, Math.floor((ANCHO - texto.length) / 2));
    return ' '.repeat(espacios) + texto;
  };
  
  const fila = (izq, der) => {
    const espacios = ANCHO - izq.length - der.length;
    return izq + ' '.repeat(Math.max(1, espacios)) + der;
  };

  const fecha = new Date(venta.created_at || new Date());
  const items = venta.detalles || venta.items || [];

  let ticket = '';
  
  // Header
  ticket += centrar(config.nombre) + '\n';
  ticket += centrar(config.direccion) + '\n';
  if (config.telefono) ticket += centrar(`Tel: ${config.telefono}`) + '\n';
  ticket += linea + '\n';
  
  // Info
  ticket += fila('Ticket:', `#${venta.numero || venta.temp_id || '---'}`) + '\n';
  ticket += fila('Fecha:', fecha.toLocaleDateString('es-BO')) + '\n';
  ticket += fila('Hora:', fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })) + '\n';
  ticket += fila('Cliente:', (venta.cliente_nombre || 'Mostrador').substring(0, 15)) + '\n';
  ticket += lineaPunteada + '\n';
  
  // Items
  for (const item of items) {
    const nombre = (item.producto_nombre || item.nombre).substring(0, ANCHO);
    ticket += nombre + '\n';
    const detalle = `  ${item.cantidad} x ${Number(item.precio_unitario || item.precio).toFixed(2)}`;
    const subtotal = `${Number(item.subtotal || (item.cantidad * (item.precio_unitario || item.precio))).toFixed(2)}`;
    ticket += fila(detalle, subtotal) + '\n';
  }
  
  // Totales
  ticket += linea + '\n';
  ticket += fila('TOTAL:', `Bs. ${Number(venta.total).toFixed(2)}`) + '\n';
  ticket += fila('Pago:', formatMetodoPago(venta.metodo_pago)) + '\n';
  ticket += linea + '\n';
  
  // Footer
  ticket += centrar(config.mensaje_pie) + '\n';
  
  return ticket;
}

export default {
  generarTicketHTML,
  generarTicketTexto,
  imprimirTicket,
};
