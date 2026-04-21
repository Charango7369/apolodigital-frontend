import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Productos from './pages/Productos'
import Categorias from './pages/Categorias'
import Ventas from './pages/Ventas'
import POS from './pages/POS'
import Reportes from './pages/Reportes'
import Movimientos from './pages/Movimientos'
import Proveedores from './pages/Proveedores'
import AdminNegocios from './pages/AdminNegocios'
import Almacenes from './pages/Almacenes'

function PrivateRoute({ children }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return token ? children : <Navigate to="/login" />
}

/**
 * Guard que solo permite el acceso a usuarios con rol superadmin.
 * Para todos los demás (admin, empleado) redirige a la raíz.
 */
function SuperadminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return user?.rol === 'superadmin' ? children : <Navigate to="/" />
}

export default function App() {
  const { token } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="productos" element={<Productos />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="movimientos" element={<Movimientos />} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="almacenes" element={<Almacenes />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="pos" element={<POS />} />
        <Route path="reportes" element={<Reportes />} />
        <Route
          path="admin/negocios"
          element={
            <SuperadminRoute>
              <AdminNegocios />
            </SuperadminRoute>
          }
        />
      </Route>
    </Routes>
  )
}
