import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { carteraApi } from '../services/api'
import { 
  CreditCard, 
  Search, 
  DollarSign, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar,
  X,
  Banknote,
  Smartphone,
  Building,
  RotateCcw
} from 'lucide-react'

export default function Cartera() {
  const location = useLocation()
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE')
  const [busqueda, setBusqueda] = useState(location.state?.ticket ? String(location.state.ticket) : '')
  
  // Estado para el modal de abono
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null)
  const [montoAbono, setMontoAbono] = useState('')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [referenciaAbono, setReferenciaAbono] = useState('')
  const [procesandoAbono, setProcesandoAbono] = useState(false)
  const [mensajeModal, setMensajeModal] = useState({ tipo: '', texto: '' })

  useEffect(() => {
    cargarCartera()
  }, [filtroEstado])

  const cargarCartera = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      const data = await carteraApi.getCartera(params)
      setCuentas(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error al cargar cartera:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModalAbono = (cuenta) => {
    setCuentaSeleccionada(cuenta)
    setMontoAbono(Number(cuenta.saldo_operativo || cuenta.saldo_pendiente).toFixed(2))
    setMetodoPago('EFECTIVO')
    setReferenciaAbono('')
    setMensajeModal({ tipo: '', texto: '' })
  }

  const cerrarModalAbono = () => {
    setCuentaSeleccionada(null)
    setMontoAbono('')
    setReferenciaAbono('')
    setMensajeModal({ tipo: '', texto: '' })
  }

  const handleRegistrarAbono = async (e) => {
    e.preventDefault()
    if (!cuentaSeleccionada) return

    const montoNum = parseFloat(montoAbono)
    const saldoActual = parseFloat(cuentaSeleccionada.saldo_operativo || cuentaSeleccionada.saldo_pendiente)

    if (isNaN(montoNum) || montoNum <= 0) {
      setMensajeModal({ tipo: 'error', texto: 'Ingrese un importe válido mayor a 0.' })
      return
    }

    if (montoNum > saldoActual) {
      setMensajeModal({ 
        tipo: 'error', 
        texto: `El importe no puede superar el saldo pendiente (Bs. ${saldoActual.toFixed(2)}).` 
      })
      return
    }

    setProcesandoAbono(true)
    setMensajeModal({ tipo: '', texto: '' })

    try {
      const payload = {
        monto: montoNum,
        metodo_pago: metodoPago,
        referencia: referenciaAbono.trim() || undefined
      }
      const resultado = await carteraApi.registrarAbono(cuentaSeleccionada.id, payload)
      
      setMensajeModal({ 
        tipo: 'success', 
        texto: `Abono de Bs. ${montoNum.toFixed(2)} registrado exitosamente. Nuevo saldo: Bs. ${Number(resultado.saldo_operativo_nuevo).toFixed(2)}` 
      })

      // Recargar la tabla y cerrar tras breve confirmación visual
      setTimeout(() => {
        cerrarModalAbono()
        cargarCartera()
      }, 1200)
    } catch (error) {
      setMensajeModal({ tipo: 'error', texto: error.message || 'Error al procesar el abono.' })
    } finally {
      setProcesandoAbono(false)
    }
  }

  // Filtrado por texto (cliente, nit, ticket)
  const cuentasFiltradas = cuentas.filter((c) => {
    const term = busqueda.toLowerCase()
    return (
      (c.cliente_nombre && c.cliente_nombre.toLowerCase().includes(term)) ||
      (c.cliente_nit && c.cliente_nit.toLowerCase().includes(term)) ||
      (c.numero_ticket && String(c.numero_ticket).includes(term))
    )
  })

  // Métricas agregadas
  const totalCarteraPendiente = cuentas
    .filter(c => c.estado === 'PENDIENTE')
    .reduce((sum, c) => sum + Number(c.saldo_operativo || c.saldo_pendiente || 0), 0)

  const totalCobradoNeto = cuentas
    .reduce((sum, c) => sum + Number(c.cobros_verificados_netos || 0), 0)

  const cuentasPendientesCount = cuentas.filter(c => c.estado === 'PENDIENTE').length

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-primary-600" />
            Cartera y Cuentas por Cobrar
          </h1>
          <p className="text-gray-500">Gestión de créditos comerciales, saldos y registro de amortizaciones</p>
        </div>
        <button
          onClick={cargarCartera}
          className="btn btn-secondary flex items-center gap-2 self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-amber-50/60 border-amber-200">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500 text-white">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-amber-700">Saldo Total por Cobrar</p>
              <p className="text-2xl font-bold text-amber-900">
                Bs. {totalCarteraPendiente.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-green-50/60 border-green-200">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-600 text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-green-700">Total Amortizado / Cobrado</p>
              <p className="text-2xl font-bold text-green-900">
                Bs. {totalCobradoNeto.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500 text-white">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-gray-500">Cuentas Activas con Deuda</p>
              <p className="text-2xl font-bold text-gray-900">{cuentasPendientesCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, NIT o ticket..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-500 font-medium">Estado:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="input text-sm w-full sm:w-auto"
          >
            <option value="PENDIENTE">Solo Pendientes</option>
            <option value="PAGADA">Totalmente Pagadas</option>
            <option value="">Todas las cuentas</option>
          </select>
        </div>
      </div>

      {/* Tabla de Cuentas */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-medium">No se encontraron cuentas por cobrar</p>
            <p className="text-xs text-gray-400 mt-1">
              {filtroEstado === 'PENDIENTE' ? 'No hay créditos pendientes de cobro.' : 'Sin registros con los filtros seleccionados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-right">Total Venta</th>
                  <th className="py-3 px-4 text-right">Cobrado / Anticipo</th>
                  <th className="py-3 px-4 text-right">Saldo Deuda</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cuentasFiltradas.map((cuenta) => {
                  const saldo = Number(cuenta.saldo_operativo || cuenta.saldo_pendiente || 0)
                  const cobrado = Number(cuenta.cobros_verificados_netos || 0)
                  const total = Number(cuenta.monto_total_venta || 0)
                  const tieneSaldo = saldo > 0

                  return (
                    <tr key={cuenta.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-800">
                        #{cuenta.numero_ticket || '---'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{cuenta.cliente_nombre || 'Cliente'}</div>
                        <div className="text-xs text-gray-400">
                          {cuenta.cliente_nit ? `NIT: ${cuenta.cliente_nit}` : ''}
                          {cuenta.cliente_telefono ? ` | Tel: ${cuenta.cliente_telefono}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700">
                        Bs. {total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-700">
                        Bs. {cobrado.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-amber-900">
                        <span className={`px-2 py-0.5 rounded ${tieneSaldo ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'}`}>
                          Bs. {saldo.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          cuenta.estado === 'PAGADA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cuenta.esta_vencida
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {cuenta.estado === 'PAGADA' ? 'Liquidada' : cuenta.esta_vencida ? `Vencida (${cuenta.dias_mora}d)` : 'Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tieneSaldo ? (
                          <button
                            onClick={() => abrirModalAbono(cuenta)}
                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Abonar
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Completada</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Registro de Abono / Amortización */}
      {cuentaSeleccionada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Banknote className="w-5 h-5" />
                  Registrar Abono / Amortización
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Ticket #{cuentaSeleccionada.numero_ticket} — {cuentaSeleccionada.cliente_nombre}
                </p>
              </div>
              <button
                onClick={cerrarModalAbono}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Formulario */}
            <form onSubmit={handleRegistrarAbono} className="p-6 space-y-4">
              {/* Tarjeta de Resumen de la Deuda */}
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-xs text-amber-700 block font-medium">Saldo pendiente actual</span>
                  <span className="text-2xl font-black text-amber-900">
                    Bs. {Number(cuentaSeleccionada.saldo_operativo || cuentaSeleccionada.saldo_pendiente).toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMontoAbono(Number(cuentaSeleccionada.saldo_operativo || cuentaSeleccionada.saldo_pendiente).toFixed(2))}
                  className="text-xs font-semibold px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg transition-colors"
                >
                  Liquidar Todo
                </button>
              </div>

              {/* Mensajes de Alerta / Éxito */}
              {mensajeModal.texto && (
                <div className={`p-3 rounded-lg text-xs font-medium ${
                  mensajeModal.tipo === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {mensajeModal.texto}
                </div>
              )}

              {/* Campo: Monto a Abonar */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Monto a Abonar (Bs.) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(cuentaSeleccionada.saldo_operativo || cuentaSeleccionada.saldo_pendiente)}
                    required
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    className="input pl-10 text-lg font-bold w-full focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              {/* Campo: Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Método de Cobro *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                    { id: 'QR', label: 'QR Simple', icon: Smartphone },
                    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
                    { id: 'TRANSFERENCIA', label: 'Transferencia', icon: Building },
                  ].map((m) => {
                    const Icon = m.icon
                    const isSelected = metodoPago === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodoPago(m.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`} />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Campo: Referencia */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Referencia / Nro. Comprobante (Opcional)
                </label>
                <input
                  type="text"
                  value={referenciaAbono}
                  onChange={(e) => setReferenciaAbono(e.target.value)}
                  placeholder="Ej. Recibo manual #452, Transf 9912..."
                  className="input text-sm w-full"
                />
              </div>

              {/* Botones de Acción */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarModalAbono}
                  disabled={procesandoAbono}
                  className="btn btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAbono}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 flex items-center gap-2 shadow"
                >
                  {procesandoAbono ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Abono
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
