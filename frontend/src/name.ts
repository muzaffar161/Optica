export function formatPersonName(value: string) {
  return value.toLocaleUpperCase('ru-RU')
}

export function personName(value: string) {
  return formatPersonName(value).trim().replace(/\s+/g, ' ')
}
