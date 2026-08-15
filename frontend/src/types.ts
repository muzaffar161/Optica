export type OrderStatus = 'new' | 'in_progress' | 'ready' | 'picked_up' | 'cancelled'
export type NotificationChannel = 'telegram' | 'sms'
export type DeliveryStatus = 'sent' | 'mocked' | 'failed'
export type Role = 'platform' | 'optics'
export type AccessLevel = 'none' | 'view' | 'edit' | 'all'
export type AccessModule = 'orders' | 'products' | 'clients' | 'journal' | 'settings'

export type OrderKind = 'catalog' | 'rx'

export type AuthUser = {
  id: string
  username: string
  role: Role
  opticsId: string | null
  opticsName: string | null
  isOwner?: boolean
  staffLimit?: number
  catalogOrders?: boolean
  rxOrders?: boolean
  theme?: string
  organizationId?: string | null
  orgOwner?: boolean
  planFeatures?: PlanFeatures
  access?: Record<AccessModule, AccessLevel>
}

export type PlanFeatures = {
  statsLevel: 'basic' | 'extended' | 'network'
  auditLevel: 'none' | 'salon' | 'extended'
  canExport: boolean
  advancedRoles: boolean
  apiAccess: boolean
  prioritySupport: boolean
}

export const DEFAULT_FEATURES: PlanFeatures = {
  statsLevel: 'basic',
  auditLevel: 'none',
  canExport: false,
  advancedRoles: false,
  apiAccess: false,
  prioritySupport: false,
}

export type Client = {
  id: string
  fullName: string
  phone: string
  telegramChatId: string | null
  createdAt: string
  updatedAt?: string
  archived?: boolean
  _count?: { orders: number }
  orders?: Order[]
}

export type NotificationLog = {
  id: string
  orderId: string
  channel: NotificationChannel
  status: DeliveryStatus
  message: string
  error: string | null
  createdAt: string
  archived?: boolean
  order?: Order
}

export type Category = {
  id: string
  name: string
  createdAt: string
  _count?: { products: number }
}

export type Product = {
  id: string
  name: string
  photoPath: string | null
  categoryId: string | null
  category?: Category | null
  createdAt: string
  updatedAt: string
}

export type OrderItem = {
  id: string
  productId: string | null
  name: string
  qty: number
  photoPath: string | null
}

export type Order = {
  id: string
  title: string
  kind?: OrderKind
  amount?: number | null
  rxJson?: string | null
  status: OrderStatus
  clientId: string
  notifiedAt: string | null
  createdAt: string
  updatedAt: string
  archived?: boolean
  client: Client
  items?: OrderItem[]
  notifications?: NotificationLog[]
}

export type Settings = {
  id: string
  opticsName: string
  address: string
  landmark: string
  phone?: string
  hours?: string
  theme?: string
  archiveAfterDays?: number
  template: string
  templateKey?: string
  templateCustom?: boolean
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Принято',
  in_progress: 'В работе',
  ready: 'Готов',
  picked_up: 'Выдан',
  cancelled: 'Отменён',
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatSum(amount?: number | null) {
  if (amount == null) return ''
  return `${amount.toLocaleString('ru-RU')} сум`
}

export function hasCatalog(user?: AuthUser | null) {
  return user?.catalogOrders !== false
}

export function hasRx(user?: AuthUser | null) {
  return !!user?.rxOrders
}

export function featuresOf(user: AuthUser | null | undefined): PlanFeatures {
  return user?.planFeatures ?? DEFAULT_FEATURES
}

export type Page<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type PlatformStats = {
  opticsCount: number
  activeOptics: number
  clientCount: number
  orderCount: number
  smsCount: number
  telegramCount: number
  ordersByStatus: Record<string, number>
}

export type StaffMember = {
  id: string
  username: string
  isOwner: boolean
  orgOwner?: boolean
  opticsId?: string | null
  active: boolean
  permOrders: AccessLevel
  permProducts: AccessLevel
  permClients: AccessLevel
  permJournal: AccessLevel
  permSettings: AccessLevel
  createdAt: string
}

export type PlatformOptics = {
  id: string
  name: string
  active: boolean
  organizationId?: string
  staffLimit?: number
  catalogOrders?: boolean
  rxOrders?: boolean
  createdAt: string
  username: string | null
  smsCount: number
  telegramCount: number
  settings?: {
    template: string
    templateKey?: string
    templateCustom: boolean
    address: string
    landmark: string
    phone?: string
    hours?: string
  } | null
  _count: { clients: number; orders: number; notifications: number }
  users: { id: string; username: string; createdAt: string }[]
}
