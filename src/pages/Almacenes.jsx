import { useState, useEffect } from 'react'
import { inventarioApi } from '../services/api'
import { Warehouse, Plus, Edit2, X, MapPin, FileText } from 'lucide-react'

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalForm, setModalForm] = useState(null) // null | 'nuevo' | almacen

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const data = await inventarioApi.getAlmacenes()
      setAlmacenes(data || [])
    } catch (error) {
      console.error('Error cargando almacenes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async (data) => {
    try {
      if (modalForm === 'nuevo') {
        await inventarioApi.createAlmacen(data)
      } else {
        await inventarioApi.updateAlmacen(modalForm.id, data)
      }
      setModalForm(null)
      cargar()
    } catch (error) {
      alert(error.message || 'Error al guardar')
      throw error
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary-600" />
            Almacenes
          </h1>
          <p className="text-sm text-gray-500">
            Ubicaciones de almacenamiento de inventario
          </p>
        </div>
        <button
          onClick={() => setModalForm('nuevo')}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo almacén
        </button>
      </div>

      {/* Aviso si hay solo 1 almacén */}
      {!loading && almacenes.length === 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          ✅ El POS selecciona automáticamente <strong>{almacenes[0].nombre}</strong> — el cajero no necesita elegir.
        </div>
      )}

      {/* Aviso si no hay almacenes */}
      {!loading && almacenes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          ⚠️ No hay almacenes creados. El POS no puede registrar ventas sin al menos uno.
          <button
            onClick={() => setModalForm('nuevo')}
            className="ml-2 underline font-medium"
          >
            Crear ahora
          </button>
        </div>
      )}

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {almacenes.map((alm) => (
            <div key={alm.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{alm.nombre}</h3>
                    {alm.activo === false && (
                      <span className="text-xs text-red-500">Inactivo</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModalForm(alm)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {alm.ubicacion && (
                <p className="text-sm text-gray-600 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                  {alm.ubicacion}
                </p>
              )}
              {alm.descripcion && (
                <p className="text-sm text-gray-500 flex items-start gap-1">
                  <FileText className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                  {alm.descripcion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalForm !== null && (
        <ModalAlmacen
          almacen={modalForm === 'nuevo' ? null : modalForm}
          onClose={() => setModalForm(null)}
          onSave={handleGuardar}
        />
      )}
    </div>
  )
}

function ModalAlmacen({ almacen, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: almacen?.nombre || '',
    ubicacion: almacen?.ubicacion || '',
    descripcion: almacen?.descripcion || '',
  })
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async () => {
    if (!form.nombre.trim()) {
      alert('El nombre del almacén es obligatorio')
      return
    }
    setGuardando(true)
    try {
      await onSave({
        nombre: form.nombre.trim(),
        ubicacion: form.ubicacion.trim() || null,
        descripcion: form.descripcion.trim() || null,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {almacen ? 'Editar almacén' : 'Nuevo almacén'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="input"
              placeholder="Principal, Bodega Norte, Sucursal Centro..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación
            </label>
            <input
              type="text"
              value={form.ubicacion}
              onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
              className="input"
              placeholder="Calle Comercio #123, Apolo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="input resize-none"
              rows={3}
              placeholder="Almacén principal de productos electrónicos..."
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="btn btn-primary w-full py-3"
          >
            {guardando ? 'Guardando...' : almacen ? 'Guardar cambios' : 'Crear almacén'}
          </button>
        </div>
      </div>
    </div>
  )
}
