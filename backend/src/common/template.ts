export const DEFAULT_TEMPLATE =
  'Здравствуйте, {fullName}! Ваш заказ «{orderTitle}» готов. Можете забрать: {address}, {opticsName}, ориентир: {landmark}.';

export type MessageTemplatePreset = {
  key: string;
  name: string;
  hint: string;
  body: string;
};

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
];

export function findTemplatePreset(key?: string | null) {
  return MESSAGE_TEMPLATES.find((item) => item.key === key) ?? null;
}

export function matchTemplateKey(body: string) {
  const text = body.trim();
  return (
    MESSAGE_TEMPLATES.find((item) => item.body.trim() === text)?.key ?? 'custom'
  );
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  const filled = template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
  return polishMessage(filled);
}

export function polishMessage(text: string) {
  const lines = text.split('\n').filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/^(линза|оправа|рецепт|к оплате|салон|адрес|ориентир|часы|телефон)\s*:?\s*$/i.test(t)) {
      return false;
    }
    if (/^ориентир\s+[—-]\s*$/i.test(t)) return false;
    if (/^[📍🕘📞]\s*$/.test(t)) return false;
    return true;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function formatAmount(amount?: number | null) {
  if (amount == null) return '';
  return `${amount.toLocaleString('ru-RU')} сум`;
}
