import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ThemeSync } from './ThemeSync'
import { ToastProvider } from './Toast'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeSync>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeSync>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
