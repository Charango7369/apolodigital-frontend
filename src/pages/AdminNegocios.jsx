import { useState, useEffect } from 'react'
import { adminApi } from '../services/api'
import {
  Building2,
  Plus,
  Edit2,
  X,
  Phone,
  User,
  Users,
  Package,
  Power,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react'

export default function AdminNegocios() {
  const [negocios, setNegocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarInactivos, setMostrarInactivos] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [credenciales, setCredenciales] = useState(null)

  useEffect(() => {
    cargar()
  }, [mostrarInactivos])

  const cargar = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getNegocios(!mostrarInactivos)
      setNegocios(data || [])
    } catch (error) {
      console.error('Error cargando negocios:', error)
      alert(error.message || 'Error al cargar negocios')
    } finally {
      setLoading(false)
    }
  }

  const handleCrear = async (data) => {
    try {
      const resultado = await adminApi.createNegocio(data)
      setModalCrear(false)
      // Mostrar credenciales en pantalla separada — solo una vez
      setCredenciales({
        negocio_nombre: resultado.negocio.nombre,
        email: resultado.admin_email,
        nombre: resultado.admin_nombre,
        password: data.admin_password,
      })
      cargar()
    } catch (error) {
      alert(error.message || 'Error al crear negocio')
      throw error
    }
  }

  const handleEditar = async (id, data) => {
    try {
      await adminApi.updateNegocio(id, data)
      setModalEditar(null)
      cargar()
    } catch (error) {
      alert(error.message || 'Error al actualizar')
      throw error
    }
  }

  const handleToggle = async (negocio) => {
    const accion = negocio.activo ? 'suspender' : 'reactivar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el negocio "${negocio.nombre}"?`)) {
      return
    }
    try {
      await adminApi.toggleNegocio(negocio.id)
      cargar()
    } catch (error) {
      alert(error.message || 'Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary-600" />
            Panel de Plataforma
          </h1>
          <p className="text-sm text-gray-500">
            Gestión de negocios clientes de ApoloDigital
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Incluir suspendidos
          </label>
          <button
            onClick={() => setModalCrear(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nuevo negocio
          </button>
        </div>
      </div>

      {/* Stats generales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total negocios"
          value={negocios.length}
          icon={Building2}
          color="blue"
        />
        <StatCard
          label="Activos"
          value={negocios.filter((n) => n.activo).length}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Total productos en plataforma"
          value={negocios.reduce((sum, n) => sum + (n.num_productos || 0), 0)}
          icon={Package}
          color="purple"
        />
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : negocios.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay negocios registrados</p>
          <button
            onClick={() => setModalCrear(true)}
            className="btn btn-primary mt-4"
          >
            Crear primer negocio
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {negocios.map((n) => (
            <NegocioCard
              key={n.id}
              negocio={n}
              onEditar={() => setModalEditar(n)}
              onToggle={() => handleToggle(n)}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {modalCrear && (
        <ModalCrearNegocio
          onClose={() => setModalCrear(false)}
          onSave={handleCrear}
        />
      )}
      {modalEditar && (
        <ModalEditarNegocio
          negocio={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={(data) => handleEditar(modalEditar.id, data)}
        />
      )}
      {credenciales && (
        <ModalCredenciales
          credenciales={credenciales}
          onClose={() => setCredenciales(null)}
        />
      )}
    </div>
  )
}

// ============ COMPONENTES AUXILIARES ============
function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg ${colors[color]} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function NegocioCard({ negocio, onEditar, onToggle }) {
  return (
    <div className={`card ${!negocio.activo ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-lg">{negocio.nombre}</h3>
            {!negocio.activo && (
              <span className="badge bg-red-100 text-red-700">Suspendido</span>
            )}
            <span className="badge bg-gray-100 text-gray-700">{negocio.moneda}</span>
          </div>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {negocio.propietario}
            </span>
            {negocio.telefono && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {negocio.telefono}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {negocio.num_usuarios} usuario{negocio.num_usuarios !== 1 && 's'}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" /> {negocio.num_productos} producto{negocio.num_productos !== 1 && 's'}
            </span>
            <span className="text-gray-400">
              Desde {new Date(negocio.created_at).toLocaleDateString('es-BO')}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onEditar}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg ${
              negocio.activo
                ? 'hover:bg-red-50 text-red-500'
                : 'hover:bg-green-50 text-green-600'
            }`}
            title={negocio.activo ? 'Suspender' : 'Reactivar'}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL CREAR ============
function ModalCrearNegocio({ onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: '',
    propietario: '',
    telefono: '',
    moneda: 'BOB',
    admin_email: '',
    admin_nombre: '',
    admin_password: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [mostrarPass, setMostrarPass] = useState(false)

  const handleSubmit = async () => {
    // Validación mínima
    if (!form.nombre.trim() || !form.propietario.trim()) {
      alert('Nombre del negocio y propietario son obligatorios')
      return
    }
    if (!form.admin_email || !form.admin_nombre || !form.admin_password) {
      alert('Datos del administrador son obligatorios')
      return
    }
    if (form.admin_password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setGuardando(true)
    try {
      await onSave({
        nombre: form.nombre.trim(),
        propietario: form.propietario.trim(),
        telefono: form.telefono.trim() || null,
        moneda: form.moneda,
        admin_email: form.admin_email.trim().toLowerCase(),
        admin_nombre: form.admin_nombre.trim(),
        admin_password: form.admin_password,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Crear nuevo negocio</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Datos del negocio */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              Datos del negocio
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del negocio *
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="input"
                placeholder="Ferretería La Paz"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Propietario *
              </label>
              <input
                type="text"
                value={form.propietario}
                onChange={(e) => setForm({ ...form, propietario: e.target.value })}
                className="input"
                placeholder="Juan Pérez"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="input"
                  placeholder="+591 7xxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <select
                  value={form.moneda}
                  onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                  className="input"
                >
                  <option value="BOB">BOB (Boliviano)</option>
                  <option value="USD">USD (Dólar)</option>
                  <option value="ARS">ARS (Peso argentino)</option>
                  <option value="PEN">PEN (Sol peruano)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              Primer administrador
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Este usuario será el administrador inicial del negocio. Anota la contraseña —
                solo se mostrará una vez.
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email del administrador *
              </label>
              <input
                type="email"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                className="input"
                placeholder="admin@negocio.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del administrador *
              </label>
              <input
                type="text"
                value={form.admin_nombre}
                onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
                className="input"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña * (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  type={mostrarPass ? 'text' : 'password'}
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  className="input pr-20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-600 hover:underline"
                >
                  {mostrarPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="btn btn-primary w-full py-3"
          >
            {guardando ? 'Creando...' : 'Crear negocio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL EDITAR ============
function ModalEditarNegocio({ negocio, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: negocio.nombre,
    propietario: negocio.propietario,
    telefono: negocio.telefono || '',
    moneda: negocio.moneda,
  })
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.propietario.trim()) {
      alert('Nombre y propietario son obligatorios')
      return
    }
    setGuardando(true)
    try {
      await onSave({
        nombre: form.nombre.trim(),
        propietario: form.propietario.trim(),
        telefono: form.telefono.trim() || null,
        moneda: form.moneda,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Editar negocio</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Propietario *</label>
            <input
              type="text"
              value={form.propietario}
              onChange={(e) => setForm({ ...form, propietario: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={form.moneda}
              onChange={(e) => setForm({ ...form, moneda: e.target.value })}
              className="input"
            >
              <option value="BOB">BOB</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="PEN">PEN</option>
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="btn btn-primary w-full py-3"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL CREDENCIALES (solo aparece una vez) ============
function ModalCredenciales({ credenciales, onClose }) {
  const [copiado, setCopiado] = useState(false)

  const copiarTodo = async () => {
    const texto = `
Negocio: ${credenciales.negocio_nombre}
Administrador: ${credenciales.nombre}
Email: ${credenciales.email}
Contraseña: ${credenciales.password}
URL: https://apolodigital-frontend.edwinjrivero.workers.dev
    `.trim()
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch (e) {
      alert('No se pudo copiar. Copia manualmente:\n\n' + texto)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Negocio creado</h2>
            <p className="text-xs text-gray-500">
              Anota estas credenciales — solo se muestran una vez
            </p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              La contraseña no se puede recuperar después. Copia estos datos ahora y entrégaselos al cliente.
            </span>
          </div>

          <div className="space-y-2 font-mono text-sm bg-gray-50 border rounded-lg p-4">
            <CredencialLine label="Negocio" value={credenciales.negocio_nombre} />
            <CredencialLine label="Admin" value={credenciales.nombre} />
            <CredencialLine label="Email" value={credenciales.email} />
            <CredencialLine label="Contraseña" value={credenciales.password} highlight />
          </div>

          <div className="flex gap-2">
            <button
              onClick={copiarTodo}
              className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> {copiado ? '¡Copiado!' : 'Copiar todo'}
            </button>
            <button onClick={onClose} className="btn btn-primary flex-1">
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CredencialLine({ label, value, highlight }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-500 min-w-[90px]">{label}:</span>
      <span className={highlight ? 'text-red-700 font-bold' : 'text-gray-900'}>{value}</span>
    </div>
  )
}
