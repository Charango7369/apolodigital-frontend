import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import { initPWA } from './initPWA'
import { syncService } from './services/syncService'
// 1. Importaciones de grado industrial para el estado del servidor
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Inicializar PWA (Service Worker, cache offline, sincronización)
initPWA()

// 2. Instanciamos el núcleo del caché
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Evita bombardeos al backend si cambias de pestaña
      retry: 1, // Solo reintenta 1 vez si falla la conexión
    },
  },
})

// Le damos a syncService acceso al queryClient para que pueda invalidar
// reportes cuando sincroniza ventas offline en segundo plano — sin esto,
// solo las ventas online (vía POS.jsx) invalidarían la caché de React Query.
syncService.setQueryClient(queryClient)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. Envolvemos la aplicación para que React Query domine el estado asíncrono */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
