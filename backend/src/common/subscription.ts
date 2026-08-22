export const DEFAULT_SUBSCRIPTION_WARN_DAYS = 7;
export const MIN_SUBSCRIPTION_WARN_DAYS = 1;
export const MAX_SUBSCRIPTION_WARN_DAYS = 30;

export function clampSubscriptionWarnDays(value?: number | null) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SUBSCRIPTION_WARN_DAYS;
  return Math.min(
    MAX_SUBSCRIPTION_WARN_DAYS,
    Math.max(MIN_SUBSCRIPTION_WARN_DAYS, n),
  );
}

export function subscriptionDaysLeft(expiresAt?: Date | string | null) {
  if (!expiresAt) return 0;
  const end = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return 0;
  const diff = end - Date.now();
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / 86_400_000));
}
