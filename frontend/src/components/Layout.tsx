import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { canView } from '../access'
import { hasCatalog, featuresOf, type AccessModule } from '../types'

const nav: { to: string; label: string; end?: boolean; module?: AccessModule; ownerOnly?: boolean; orgOwnerOnly?: boolean }[] = [
  { to: '/', label: 'Заказы', end: true, module: 'orders' },
  { to: '/products', label: 'Товары', module: 'products' },
  { to: '/clients', label: 'Клиенты', module: 'clients' },
  { to: '/notifications', label: 'Журнал', module: 'journal' },
  { to: '/settings', label: 'Настройки', module: 'settings' },
  { to: '/staff', label: 'Филиалы', ownerOnly: true },
  { to: '/reports', label: 'Отчёты', ownerOnly: true },
  { to: '/audit', label: 'Журнал действий', ownerOnly: true },
  { to: '/billing', label: 'Подписка', orgOwnerOnly: true },
  { to: '/sms', label: 'SMS', orgOwnerOnly: true },
  { to: '/integrations', label: 'API', orgOwnerOnly: true },
]

function Brand({ name }: { name?: string | null }) {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden>
        <circle cx="10" cy="16" r="5.2" fill="none" stroke="#d4b483" strokeWidth="2" />
        <circle cx="22" cy="16" r="5.2" fill="none" stroke="#d4b483" strokeWidth="2" />
        <path d="M15.2 16h1.6" stroke="#d4b483" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div>
        <div className="font-display text-xl leading-none lowercase">optika</div>
        {name && <div className="mt-1 text-xs text-white/55">{name}</div>}
      </div>
    </div>
  )
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const items = nav.filter((item) => {
    const features = featuresOf(user)
    if (item.to === '/audit' && features.auditLevel === 'none') return false
    if (item.to === '/integrations' && !features.apiAccess) return false
    if (item.orgOwnerOnly) return !!user?.orgOwner
    if (item.ownerOnly) return user?.isOwner !== false
    if (item.module === 'products' && !hasCatalog(user)) return false
    return !item.module || canView(user, item.module)
  })
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-lg px-3 py-3.5 text-lg md:py-2.5 md:text-sm transition ${
              isActive
                ? 'bg-nav-soft text-white'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const isNewOrder = location.pathname === '/new-order'

  const asideInner = (
    <>
      <Brand name={user?.opticsName} />
      <Nav onNavigate={() => setMenuOpen(false)} />
      <div className="border-t border-white/10 px-5 py-4">
        <div className="text-xs text-white/50">Вы вошли как</div>
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
    <div className={`flex bg-paper ${isNewOrder ? 'h-dvh overflow-hidden' : 'min-h-svh'}`}>
      <aside className={`w-60 shrink-0 flex-col bg-nav text-white print:hidden ${isNewOrder ? 'hidden' : 'hidden md:flex'}`}>
        {asideInner}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-nav text-white shadow-xl">
            {asideInner}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!isNewOrder && (
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-card/95 px-4 py-3 backdrop-blur print:hidden md:hidden">
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
            <div className="min-w-0 flex-1 font-display text-lg leading-none lowercase">optika</div>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted hover:text-ink"
            >
              Выйти
            </button>
          </header>
        )}
        <main
          className={`min-w-0 flex-1 ${
            isNewOrder ? 'p-0' : 'p-4 md:p-8'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
