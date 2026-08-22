import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import PullToRefresh from './PullToRefresh'

export default function PlatformLayout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const aside = (
    <>
      <div className="flex items-center gap-3 px-5 py-6">
        <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden>
          <circle cx="10" cy="16" r="5.2" fill="none" stroke="#d4b483" strokeWidth="2" />
          <circle cx="22" cy="16" r="5.2" fill="none" stroke="#d4b483" strokeWidth="2" />
          <path d="M15.2 16h1.6" stroke="#d4b483" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div>
          <div className="font-display text-xl leading-none lowercase">optika</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-brass">
            платформа
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {[
          { to: '/platform', label: 'Салоны', end: true },
          { to: '/platform/sms', label: 'SMS' },
          { to: '/platform/templates', label: 'Шаблоны' },
          { to: '/platform/organizations', label: 'Подписки' },
          { to: '/platform/payments', label: 'Платежи' },
          { to: '/platform/plans', label: 'Тарифы' },
          { to: '/platform/sms-packages', label: 'SMS-пакеты' },
          { to: '/platform/usage', label: 'Тест' },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `rounded-lg px-3 py-3.5 text-lg md:py-2.5 md:text-sm transition ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="text-xs text-white/50">Главный админ</div>
        <div className="mt-0.5 text-sm">{user?.username}</div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 text-xs text-brass hover:underline"
        >
          Выйти
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-svh bg-paper">
      <aside className="hidden w-60 shrink-0 flex-col bg-[#101418] text-white md:flex">
        {aside}
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-[#101418] text-white">
            {aside}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-card/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line"
            aria-label="Меню"
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
              <path
                d="M1 1h16M1 7h16M1 13h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="min-w-0 flex-1 font-display text-lg lowercase">optika admin</div>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-muted hover:text-ink"
          >
            Выйти
          </button>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <PullToRefresh>
            <Outlet />
          </PullToRefresh>
        </main>
      </div>
    </div>
  )
}
