import type { AccessLevel, AccessModule, AuthUser } from './types'

const RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  all: 3,
}

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  none: 'закрыто',
  view: 'смотреть',
  edit: 'менять',
  all: 'всё',
}

export const MODULE_LABEL: Record<AccessModule, string> = {
  orders: 'Заказы',
  products: 'Товары',
  clients: 'Клиенты',
  journal: 'Журнал',
  settings: 'Настройки',
}

export const MODULES: AccessModule[] = [
  'orders',
  'products',
  'clients',
  'journal',
  'settings',
]

export function levelOf(user: AuthUser | null | undefined, module: AccessModule): AccessLevel {
  if (!user) return 'none'
  if (user.isOwner || !user.access) return 'all'
  return user.access[module] ?? 'none'
}

export function canView(user: AuthUser | null | undefined, module: AccessModule) {
  return RANK[levelOf(user, module)] >= RANK.view
}

export function canEdit(user: AuthUser | null | undefined, module: AccessModule) {
  return RANK[levelOf(user, module)] >= RANK.edit
}

export function canAll(user: AuthUser | null | undefined, module: AccessModule) {
  return RANK[levelOf(user, module)] >= RANK.all
}

export function firstAllowedPath(user: AuthUser) {
  if (canView(user, 'orders')) return '/'
  if (canView(user, 'products') && user.catalogOrders !== false) return '/products'
  if (canView(user, 'clients')) return '/clients'
  if (canView(user, 'journal')) return '/notifications'
  if (canView(user, 'settings')) return '/settings'
  if (user.isOwner) return '/staff'
  return '/'
}

export function pathModule(pathname: string): AccessModule | 'staff' | null {
  if (pathname === '/' || pathname === '/new-order') return 'orders'
  if (pathname.startsWith('/products')) return 'products'
  if (pathname.startsWith('/clients')) return 'clients'
  if (pathname.startsWith('/notifications')) return 'journal'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/staff')) return 'staff'
  if (
    pathname.startsWith('/billing') ||
    pathname.startsWith('/sms') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/audit') ||
    pathname.startsWith('/integrations')
  ) {
    return 'staff'
  }
  return null
}
