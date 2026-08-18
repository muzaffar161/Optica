import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js'

export const UZ_DEFAULT = '+998'

export function formatPhoneInput(value: string): string {
  if (!value.trim()) return ''
  const digits = value.replace(/\D/g, '')
  if (value.trim() === '+' || value.trim() === '+9' || value.trim() === '+99') {
    return value.startsWith('+') ? `+${digits}` : digits
  }
  if (value.startsWith('+')) {
    return new AsYouType().input(value)
  }
  if (digits.startsWith('998')) {
    return new AsYouType().input(`+${digits}`)
  }
  return new AsYouType('UZ').input(value)
}

export function isPhoneValid(value: string): boolean {
  if (!value.trim()) return false
  if (isValidPhoneNumber(value)) return true
  if (isValidPhoneNumber(value, 'UZ')) return true
  const parsed =
    parsePhoneNumberFromString(value) || parsePhoneNumberFromString(value, 'UZ')
  return !!parsed?.isValid()
}

export function toE164(value: string): string | null {
  const parsed =
    parsePhoneNumberFromString(value) || parsePhoneNumberFromString(value, 'UZ')
  return parsed?.isValid() ? parsed.number : null
}

export function looksLikePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  const letters = value.replace(/[\d\s+().-]/g, '')
  return digits.length >= 3 && letters.length === 0
}
