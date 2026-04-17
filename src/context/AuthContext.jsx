import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

const USER_CACHE_KEY = 'user_cache'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Hidrata user desde localStorage para arranque offline
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      loadUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const loadUser = async () => {
    // Si estamos offline, usar el user cacheado y no intentar llamar a la API
    if (!navigator.onLine) {
      console.log('[Auth] Offline: usando user cacheado')
      setLoading(false)
      return
    }

    try {
      const userData = await authApi.me()
      setUser(userData)
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData))
    } catch (error) {
      console.error('[Auth] Error cargando user:', error)

      // Diferenciar: error de red vs error de token inválido (401)
      const isNetworkError =
        error.message?.includes('fetch') ||
        error.message?.includes('Failed') ||
        error.message?.includes('Network')

      if (isNetworkError) {
        // Red caída: mantener sesión con el user cacheado
        console.log('[Auth] Error de red, manteniendo sesión cacheada')
      } else {
        // Token inválido o expirado: logout real
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await authApi.login(email, password)

    localStorage.setItem('token', response.access_token)
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(response.user))
    setToken(response.access_token)
    setUser(response.user)

    return response.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem(USER_CACHE_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
