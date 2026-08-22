import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Overlay = {
  visible: boolean
  addEventListener: (type: 'geometrychange', listener: () => void) => void
  removeEventListener: (type: 'geometrychange', listener: () => void) => void
}

let deferred: BeforeInstallPromptEvent | null = null
let booted = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function overlay(): Overlay | undefined {
  return (navigator as Navigator & { windowControlsOverlay?: Overlay }).windowControlsOverlay
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isWindowControlsOverlay() {
  return Boolean(overlay()?.visible)
}

export function isIos() {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function syncPwaClass() {
  if (typeof document === 'undefined') return
  const standalone = isStandalone()
  const wco = isWindowControlsOverlay()
  document.documentElement.classList.toggle('pwa', standalone || wco)
  document.documentElement.classList.toggle('pwa-wco', wco)
  if (standalone || wco) document.title = 'Оптика'
  notify()
}

export function bootPwaInstall() {
  if (booted || typeof window === 'undefined') return
  booted = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
  const modes = ['standalone', 'window-controls-overlay', 'fullscreen'] as const
  for (const mode of modes) {
    window.matchMedia(`(display-mode: ${mode})`).addEventListener('change', syncPwaClass)
  }
  overlay()?.addEventListener('geometrychange', syncPwaClass)
  syncPwaClass()
}

export function canPromptInstall() {
  return deferred != null
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const event = deferred
  deferred = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome
}

export function usePwaInstall() {
  const [, bump] = useState(0)
  useEffect(() => {
    bootPwaInstall()
    const on = () => bump((n) => n + 1)
    listeners.add(on)
    return () => {
      listeners.delete(on)
    }
  }, [])
  return {
    installed: isStandalone(),
    canPrompt: canPromptInstall(),
    ios: isIos(),
    wco: isWindowControlsOverlay(),
  }
}

export function PwaTitlebar() {
  const pwa = usePwaInstall()
  if (!pwa.wco) return null
  return (
    <div className="pwa-titlebar" aria-hidden>
      optika
    </div>
  )
}
