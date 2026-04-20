import { useState, useEffect } from 'react'
import { inventarioApi } from '../services/api'
import { Plus, Edit2, Truck, X, Phone } from 'lucide-react'

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  useEffect(() => {
    cargar()
  }, [mostrarInactivos])

  const cargar = async () => {
    try {
      setLoading(true)
      const data = await inventarioApi.getProveedores(!mostrarInactivos)
      setProveedores(data || [])
    } catch (error) {
      console.error('Error cargando proveedores:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModalNuevo = () => {
    setEditando(null)
    setModalOpen(true)
  }

  const abrirModalEditar = (prov) => {
    setEditando(prov)
    setModalOpen(true)
  }

  const guardar = async (data) => {
    try {
      if (editando) {
        await inventarioApi.updateProveedor(editando.id, data)
      } else {
        await inventarioApi.createProveedor(data)
      }
      setModalOpen(false)
      cargar()
    } catch (error) {
      alert(error.message || 'Error al guardar')
    }
  }

  const desactivar = async (prov) => {
    if (!confirm(`¿Desactivar el proveedor "${prov.nombre}"?`)) return
    try {
      await inventarioApi.updateProveedor(prov.id, { activo: false })
      cargar()
    } catch (error) {
      alert(error.message || 'Error al desactivar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500">Gestiona los proveedores del negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Mostrar inactivos
          </label>
          <button onClick={abrirModalNuevo} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : proveedores.length === 0 ? (
        <div className="card text-center py-12">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay proveedores registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {proveedores.map((p) => (
            <div key={p.id} className={`card ${!p.activo ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.nombre}</h3>
                  {p.telefono && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" /> {p.telefono}
                    </p>
                  )}
                  {p.notas && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{p.notas}</p>}
                  {!p.activo && <span className="badge bg-gray-200 text-gray-700 mt-2">Inactivo</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => abrirModalEditar(p)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {p.activo && (
                    <button
                      onClick={() => desactivar(p)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500 text-xs"
                      title="Desactivar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ModalProveedor proveedor={editando} onClose={() => setModalOpen(false)} onSave={guardar} />
      )}
    </div>
  )
}

function ModalProveedor({ proveedor, onClose, onSave }) {
  const [nombre, setNombre] = useState(proveedor?.nombre || '')
  const [telefono, setTelefono] = useState(proveedor?.telefono || '')
  const [notas, setNotas] = useState(proveedor?.notas || '')
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      alert('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    await onSave({
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      notas: notas.trim() || null,
    })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="input"
              placeholder="Distribuidora La Paz"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="input"
              placeholder="+591 7xxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="input"
              rows={3}
              placeholder="Dirección, condiciones de pago, etc."
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="btn btn-primary w-full py-3"
          >
            {guardando ? 'Guardando...' : proveedor ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  )
}
