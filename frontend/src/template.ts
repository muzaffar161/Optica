export const TEMPLATE_VARS = [
  { key: 'firstName', label: 'Имя', sample: 'Farxod' },
  { key: 'fullName', label: 'ФИО', sample: 'Farxod Karimov' },
  { key: 'orderTitle', label: 'Заказ', sample: 'Очки для дали: OD Sph +1,25 Cyl -0,50' },
  { key: 'rx', label: 'Рецепт', sample: 'OD Sph +1,25 Cyl -0,50 ax 180' },
  { key: 'lens', label: 'Линза', sample: 'Essilor 1.6 AS' },
  { key: 'frame', label: 'Оправа', sample: 'Ray-Ban RB5228' },
  { key: 'amount', label: 'К оплате', sample: '300 000 сум' },
  { key: 'total', label: 'Итог', sample: '500 000 сум' },
  { key: 'paid', label: 'Оплачено', sample: '200 000 сум' },
  { key: 'opticsName', label: 'Название оптики', sample: 'Оптика Юнусабад' },
  { key: 'address', label: 'Адрес', sample: 'ул. Амира Темура 12' },
  { key: 'landmark', label: 'Ориентир', sample: 'рядом с "Korzinka"' },
  { key: 'hours', label: 'Часы', sample: '9:00–20:00' },
  { key: 'phone', label: 'Телефон салона', sample: '+998 90 123 45 67' },
] as const

export const SAMPLE_VARS: Record<string, string> = Object.fromEntries(
  TEMPLATE_VARS.map((item) => [item.key, item.sample]),
)

export const DEFAULT_TEMPLATE =
  'Здравствуйте, {fullName}! Ваш заказ «{orderTitle}» готов. Можете забрать: {address}, {opticsName}, ориентир: {landmark}.'

export type MessageTemplatePreset = {
  key: string
  name: string
  hint: string
  body: string
}

export const MESSAGE_TEMPLATES: MessageTemplatePreset[] = [
  {
    key: 'compact',
    name: 'Короткое',
    hint: 'Одно сообщение в строку — удобно для SMS',
    body: DEFAULT_TEMPLATE,
  },
  {
    key: 'card',
    name: 'Карточка',
    hint: 'Линза, оправа и сумма с новой строки',
    body: `{firstName}, ваш заказ готов!

Рецепт:
{rx}
Линза: {lens}
Оправа: {frame}
Итог: {total}
Оплачено: {paid}
К оплате: {amount}

📍 {opticsName}, {address}
   ориентир — {landmark}
🕘 {hours}`,
  },
  {
    key: 'cardPhone',
    name: 'Карточка с телефоном',
    hint: 'То же плюс номер салона',
    body: `{firstName}, ваш заказ готов!

Рецепт:
{rx}
Линза: {lens}
Оправа: {frame}
Итог: {total}
Оплачено: {paid}
К оплате: {amount}

📍 {opticsName}, {address}
   ориентир — {landmark}
🕘 {hours}
📞 {phone}`,
  },
  {
    key: 'sms',
    name: 'Короткое с адресом',
    hint: 'Имя, адрес, часы и телефон в одном абзаце',
    body: '{firstName}, ваш заказ готов. {opticsName}, {address}. {hours} {phone}',
  },
  {
    key: 'formal',
    name: 'Официальное',
    hint: 'Полное имя, заказ и контакты салона',
    body: `Здравствуйте, {fullName}!

Ваш заказ «{orderTitle}» готов к выдаче.

Салон: {opticsName}
Адрес: {address}
Ориентир: {landmark}
Часы: {hours}
Телефон: {phone}`,
  },
]

export function findTemplatePreset(key?: string | null) {
  return MESSAGE_TEMPLATES.find((item) => item.key === key) ?? null
}

export function matchTemplateKey(body: string) {
  const text = body.trim()
  return MESSAGE_TEMPLATES.find((item) => item.body.trim() === text)?.key ?? 'custom'
}

export function polishMessage(text: string) {
  const lines = text.split('\n').filter((line) => {
    const t = line.trim()
    if (!t) return true
    if (/укажите (адрес|ориентир) в настройках/i.test(t)) return false
    if (/^(линза|оправа|рецепт|итог|оплачено|к оплате|салон|адрес|ориентир|часы|телефон)\s*:?\s*$/i.test(t)) {
      return false
    }
    if (/^ориентир\s+[—-]\s*$/i.test(t)) return false
    if (/^[📍🕘📞]\s*$/.test(t)) return false
    return true
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function renderTemplate(template: string, vars: Record<string, string>) {
  const filled = template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
  return polishMessage(filled)
}

export function insertAtCursor(
  value: string,
  insert: string,
  start: number,
  end: number,
) {
  return {
    next: value.slice(0, start) + insert + value.slice(end),
    caret: start + insert.length,
  }
}
