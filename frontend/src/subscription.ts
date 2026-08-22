export const DEFAULT_SUBSCRIPTION_WARN_DAYS = 7
export const MIN_SUBSCRIPTION_WARN_DAYS = 1
export const MAX_SUBSCRIPTION_WARN_DAYS = 30

export function clampSubscriptionWarnDays(value?: number | null) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return DEFAULT_SUBSCRIPTION_WARN_DAYS
  return Math.min(MAX_SUBSCRIPTION_WARN_DAYS, Math.max(MIN_SUBSCRIPTION_WARN_DAYS, n))
}

export function daysWord(n: number) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

export function remainingPhrase(days: number) {
  if (days <= 0) return 'Подписка закончилась'
  if (days === 1) return 'Остался 1 день'
  return `Осталось ${days} ${daysWord(days)}`
}

export function isSubscriptionActive(user: { role?: string; subscriptionActive?: boolean } | null | undefined) {
  if (!user || user.role !== 'optics') return true
  return user.subscriptionActive !== false
}
