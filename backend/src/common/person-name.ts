export function personName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('ru-RU');
}
