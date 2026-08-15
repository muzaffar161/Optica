import { useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { applyTheme, readStoredTheme } from './themes'

export function ThemeSync({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  useEffect(() => {
    applyTheme(readStoredTheme())
  }, [])

  useEffect(() => {
    if (user?.role === 'optics') {
      applyTheme(user.theme || 'atelier')
      return
    }
    if (user?.role === 'platform') {
      document.documentElement.dataset.theme = 'atelier'
    }
  }, [user?.role, user?.theme])

  return children
}
