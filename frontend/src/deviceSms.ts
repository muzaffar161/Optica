import { toE164 } from './phone'
import type { DeviceSms } from './types'

export type { DeviceSms }

export function smsAppHref(phone: string, body: string) {
  const n = toE164(phone) || phone.replace(/[^\d+]/g, '')
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return `sms:${n}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`
}

export function openDeviceSms(draft: DeviceSms) {
  const body = draft.messages.filter(Boolean).join('\n\n')
  if (!body) return
  window.location.href = smsAppHref(draft.phone, body)
}
