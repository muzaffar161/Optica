import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.startsWith('998') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.startsWith('8') && digits.length === 10) {
    return `+998${digits.slice(1)}`;
  }
  if (digits.startsWith('8') && digits.length === 11) {
    return `+998${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  const parsed =
    parsePhoneNumberFromString(normalized) ||
    parsePhoneNumberFromString(input, 'UZ');
  return !!parsed?.isValid();
}

export function toE164(input: string): string | null {
  const normalized = normalizePhone(input);
  const parsed =
    parsePhoneNumberFromString(normalized) ||
    parsePhoneNumberFromString(input, 'UZ');
  if (!parsed?.isValid()) {
    return null;
  }
  return parsed.number;
}

export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

export function foldText(input: string): string {
  return input.trim().toLowerCase();
}

export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}
