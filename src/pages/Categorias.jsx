import { useState, useEffect } from 'react'
import { inventarioApi } from '../services/api'
import { Plus, Edit2, Trash2, Tags, X } from 'lucide-react'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [categoriaEdit, setCategoriaEdit] = useState(null)

  useEffect(() => {
    loadCategorias()
  }, [])

  const loadCategorias = async () => {
    try {
      const data = await inventarioApi.getCategorias()
      setCategorias(data)
    } catch (error) {
      console.error('Error loading categorias:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await inventarioApi.deleteCategoria(id)
      loadCategorias()
    } catch (error) {
      alert(error.message)
    }
  }

  const openModal = (categoria = null) => {
    setCategoriaEdit(categoria)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setCategoriaEdit(null)
  }

  const handleSave = async (data) => {
    try {
      if (categoriaEdit) {
        await inventarioApi.updateCategoria(categoriaEdit.id, data)
      } else {
        await inventarioApi.createCategoria(data)
      }
      closeModal()
      loadCategorias()
    } catch (error) {
      alert(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500">{categorias.length} categorías</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nueva categoría
        </button>
      </div>

      {/* Lista */}
      {categorias.length === 0 ? (
        <div className="card text-center py-12">
          <Tags className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay categorías</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            Crear primera categoría
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categorias.map((categoria) => (
            <div key={categoria.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{categoria.icono || '📁'}</span>
                <div>
                  <h3 className="font-medium text-gray-900">{categoria.nombre}</h3>
                  <span className={`badge ${categoria.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {categoria.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openModal(categoria)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(categoria.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <CategoriaModal
          categoria={categoriaEdit}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function CategoriaModal({ categoria, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: categoria?.nombre || '',
    icono: categoria?.icono || '',
    activa: categoria?.activa ?? true,
  })
  const [saving, setSaving] = useState(false)

  const iconos = ['📦', '🛒', '📱', '💻', '🎮', '👕', '🍔', '🏠', '🔧', '📚', '💊', '🎁']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {categoria ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="input"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icono</label>
            <div className="flex flex-wrap gap-2">
              {iconos.map((icono) => (
                <button
                  key={icono}
                  type="button"
                  onClick={() => setForm({ ...form, icono })}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors ${
                    form.icono === icono
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {icono}
                </button>
              ))}
            </div>
          </div>
          
          {categoria && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.activa}
                onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Categoría activa</span>
            </label>
          )}
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
