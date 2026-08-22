import { useState, type FormEvent } from 'react'
import { useAuth } from '../AuthContext'
import type { Role } from '../types'

type Audience = 'shop' | 'platform'

export default function Login({ audience }: { audience: Audience }) {
  const { login, logout } = useAuth()
  const isPlatform = audience === 'platform'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      const me = await login(username.trim(), password)
      const expected: Role = isPlatform ? 'platform' : 'optics'
      if (me.role !== expected) {
        logout()
        setError(
          isPlatform
            ? 'Это вход платформы. Салон входит на /login'
            : 'Это вход салона. Платформа: /platform/login',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className={`flex min-h-svh items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${
        isPlatform ? 'bg-[#101418]' : 'bg-paper'
      }`}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border p-8 shadow-sm ${
          isPlatform ? 'border-white/10 bg-[#161c21] text-white' : 'border-line bg-card'
        }`}
      >
        <div className="mb-6 flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="8" fill={isPlatform ? '#0b0e11' : '#14261f'} />
            <circle cx="10" cy="16" r="5.2" fill="none" stroke="#d4b483" strokeWidth="2" />
            <circle cx="22" cy="16" r="5.2" fill="none" stroke="#d4b483" strokeWidth="2" />
            <path d="M15.2 16h1.6" stroke="#d4b483" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <div className={`font-display text-2xl ${isPlatform ? 'text-white' : ''}`}>
              optika
            </div>
            <div
              className={`text-xs uppercase tracking-[0.16em] ${
                isPlatform ? 'text-brass' : 'text-muted'
              }`}
            >
              {isPlatform ? 'платформа' : 'вход в панель'}
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span
              className={`mb-1 block text-sm ${isPlatform ? 'text-white/50' : 'text-muted'}`}
            >
              Логин
            </span>
            <input
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full rounded-xl border px-3 py-2.5 outline-none ${
                isPlatform
                  ? 'border-white/10 bg-[#101418] text-white'
                  : 'border-line bg-white'
              }`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span
              className={`mb-1 block text-sm ${isPlatform ? 'text-white/50' : 'text-muted'}`}
            >
              Пароль
            </span>
            <input
              required
              type="password"
              className={`w-full rounded-xl border px-3 py-2.5 outline-none ${
                isPlatform
                  ? 'border-white/10 bg-[#101418] text-white'
                  : 'border-line bg-white'
              }`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className={`text-sm ${isPlatform ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className={`w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 ${
              isPlatform
                ? 'bg-brass text-[#101418] hover:bg-[#d4b483]'
                : 'bg-ink text-white hover:bg-ink-soft'
            }`}
          >
            {pending ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
