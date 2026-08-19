import { getToken } from './api'

export type UsageMeta = Record<string, string | number | boolean>

type UsageEvent = {
  name: string
  path?: string
  ms?: number
  meta?: UsageMeta
}

const queue: UsageEvent[] = []
let timer: number | null = null
let flushing = false
let booted = false

export function bootUsage() {
  if (booted || typeof window === 'undefined') return
  booted = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushUsage()
  })
  window.addEventListener('pagehide', () => {
    void flushUsage()
  })
}

export function track(
  name: string,
  extra?: { ms?: number; path?: string; meta?: UsageMeta },
) {
  if (typeof window === 'undefined' || !getToken()) return
  queue.push({
    name,
    path: (extra?.path ?? window.location.pathname).slice(0, 80),
    ms: extra?.ms,
    meta: extra?.meta,
  })
  if (queue.length >= 12) {
    void flushUsage()
    return
  }
  if (timer == null) {
    timer = window.setTimeout(() => {
      timer = null
      void flushUsage()
    }, 2000)
  }
}

export function trackSession() {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem('optika_usage_session')) return
    sessionStorage.setItem('optika_usage_session', '1')
  } catch {
    return
  }
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  track('session', {
    meta: {
      pwa: standalone,
      w: Math.round(window.innerWidth / 50) * 50,
    },
  })
}

async function flushUsage() {
  if (flushing || !queue.length) return
  const token = getToken()
  if (!token) {
    queue.length = 0
    return
  }
  flushing = true
  if (timer != null) {
    window.clearTimeout(timer)
    timer = null
  }
  const batch = queue.splice(0, 40)
  try {
    await fetch('/api/usage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: batch }),
    })
  } catch {
    /* drop */
  } finally {
    flushing = false
    if (queue.length) {
      timer = window.setTimeout(() => {
        timer = null
        void flushUsage()
      }, 1500)
    }
  }
}
