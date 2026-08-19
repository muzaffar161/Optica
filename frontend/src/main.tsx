import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ThemeSync } from './ThemeSync'
import { ToastProvider } from './Toast'
import OfflineBanner from './components/OfflineBanner'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeSync>
          <ToastProvider>
            <OfflineBanner />
            <App />
          </ToastProvider>
        </ThemeSync>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
