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
];

export type MessageLang = 'ru' | 'uz' | 'both';

export function langsOf(lang?: string | null): Array<'ru' | 'uz'> {
  if (lang === 'uz') return ['uz'];
  if (lang === 'both') return ['ru', 'uz'];
  return ['ru'];
}

export type CatalogTemplate = {
  id: string;
  name: string;
  hint: string;
  kind?: string;
  bodyRu: string;
  bodyUz: string;
  smsRu: string;
  smsUz: string;
};

export const DEFAULT_SMS_RU = '{firstName}, заказ готов. {opticsName}, {address}';
export const DEFAULT_SMS_UZ = '{firstName}, buyurtma tayyor. {opticsName}, {address}';

export const SEED_TEMPLATES: CatalogTemplate[] = [
  {
    id: 'tpl_compact',
    name: 'Короткое',
    hint: 'Одно сообщение в строку — удобно для SMS',
    bodyRu: DEFAULT_TEMPLATE,
    bodyUz:
      "Assalomu alaykum, {fullName}! «{orderTitle}» buyurtmangiz tayyor. Olib ketishingiz mumkin: {address}, {opticsName}, mo'ljal: {landmark}.",
    smsRu: DEFAULT_SMS_RU,
    smsUz: DEFAULT_SMS_UZ,
  },
  {
    id: 'tpl_card',
    name: 'Карточка',
    hint: 'Линза, оправа и сумма с новой строки',
    bodyRu: `{firstName}, ваш заказ готов!

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
    smsRu: '{firstName}, заказ готов. К оплате {amount}. {opticsName}',
    smsUz: '{firstName}, buyurtma tayyor. Tolov {amount}. {opticsName}',
    bodyUz: `{firstName}, buyurtmangiz tayyor!

Retsept:
{rx}
Linza: {lens}
Ramka: {frame}
Jami: {total}
To'landi: {paid}
To'lov: {amount}

📍 {opticsName}, {address}
   mo'ljal — {landmark}
🕘 {hours}`,
  },
  {
    id: 'tpl_cardPhone',
    name: 'Карточка с телефоном',
    hint: 'То же плюс номер салона',
    bodyRu: `{firstName}, ваш заказ готов!

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
    smsRu: '{firstName}, заказ готов. К оплате {amount}. {opticsName}',
    smsUz: '{firstName}, buyurtma tayyor. Tolov {amount}. {opticsName}',
    bodyUz: `{firstName}, buyurtmangiz tayyor!

Retsept:
{rx}
Linza: {lens}
Ramka: {frame}
Jami: {total}
To'landi: {paid}
To'lov: {amount}

📍 {opticsName}, {address}
   mo'ljal — {landmark}
🕘 {hours}
📞 {phone}`,
  },
  {
    id: 'tpl_sms',
    name: 'Короткое с адресом',
    hint: 'Имя, адрес, часы и телефон в одном абзаце',
    bodyRu: '{firstName}, ваш заказ готов. {opticsName}, {address}. {hours} {phone}',
    bodyUz: "{firstName}, buyurtmangiz tayyor. {opticsName}, {address}. {hours} {phone}",
    smsRu: DEFAULT_SMS_RU,
    smsUz: DEFAULT_SMS_UZ,
  },
  {
    id: 'tpl_formal',
    name: 'Официальное',
    hint: 'Полное имя, заказ и контакты салона',
    bodyRu: `Здравствуйте, {fullName}!

Ваш заказ «{orderTitle}» готов к выдаче.

Салон: {opticsName}
Адрес: {address}
Ориентир: {landmark}
Часы: {hours}
Телефон: {phone}`,
    bodyUz: `Assalomu alaykum, {fullName}!

«{orderTitle}» buyurtmangiz tayyor.

Salon: {opticsName}
Manzil: {address}
Mo'ljal: {landmark}
Soat: {hours}
Telefon: {phone}`,
    smsRu: DEFAULT_SMS_RU,
    smsUz: DEFAULT_SMS_UZ,
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
    if (/укажите (адрес|ориентир) в настройках/i.test(t)) return false;
    if (
      /^(линза|оправа|рецепт|итог|оплачено|к оплате|салон|адрес|ориентир|часы|телефон|linza|ramka|retsept|jami|to['']landi|to['']lov|manzil|mo['']ljal|soat)\s*:?\s*$/i.test(
        t,
      )
    ) {
      return false;
    }
    if (/^(ориентир|mo['']ljal)\s+[—-]\s*$/i.test(t)) return false;
    if (/^[📍🕘📞]\s*$/.test(t)) return false;
    return true;
  });
  return lines
    .map((line) =>
      /^[📍]/.test(line.trim()) ? line.replace(/,\s*$/, '') : line,
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function publicPlace(value?: string | null) {
  const text = value?.trim() ?? '';
  if (!text || /укажите/i.test(text)) return '';
  return text;
}

export function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function formatAmount(amount?: number | null) {
  if (amount == null) return '';
  return `${amount.toLocaleString('ru-RU')} сум`;
}

export function moneyVars(amount?: number | null, paidAmount?: number | null) {
  const paid = Math.max(0, paidAmount ?? 0);
  const due = amount == null ? null : Math.max(0, amount - paid);
  const showPaid = paid > 0 && amount != null;
  return {
    total: showPaid ? formatAmount(amount) : '',
    paid: showPaid ? formatAmount(paid) : '',
    amount: formatAmount(due ?? amount),
  };
}

export function withPaymentPlaceholders(
  template: string,
  paidAmount?: number | null,
  lang: 'ru' | 'uz' = 'ru',
) {
  if (!paidAmount || paidAmount <= 0) return template;
  if (template.includes('{paid}') || template.includes('{total}')) return template;
  if (template.includes('К оплате: {amount}')) {
    return template.replace(
      'К оплате: {amount}',
      'Итог: {total}\nОплачено: {paid}\nК оплате: {amount}',
    );
  }
  if (template.includes("To'lov: {amount}") || template.includes('To‘lov: {amount}')) {
    return template.replace(
      /To['']lov: \{amount\}/,
      "Jami: {total}\nTo'landi: {paid}\nTo'lov: {amount}",
    );
  }
  if (lang === 'uz') {
    return `${template}\nJami: {total}\nTo'landi: {paid}\nTo'lov: {amount}`;
  }
  return `${template}\nИтог: {total}\nОплачено: {paid}\nК оплате: {amount}`;
}

export function attachRxPlaceholder(template: string, rxText: string) {
  if (!rxText) return template;
  if (template.includes('{rx}') || template.includes('{orderTitle}')) return template;
  if (template.includes('Линза:')) {
    return template.replace('Линза:', 'Рецепт:\n{rx}\nЛинза:');
  }
  if (template.includes('Linza:')) {
    return template.replace('Linza:', 'Retsept:\n{rx}\nLinza:');
  }
  return `${template}\n{rx}`;
}

export function pickSmsBody(
  tpl: { bodyRu?: string | null; bodyUz?: string | null; smsRu?: string | null; smsUz?: string | null } | null,
  lang: 'ru' | 'uz',
  fallback = '',
) {
  if (lang === 'uz') {
    return (tpl?.smsUz || tpl?.bodyUz || '').trim();
  }
  return (tpl?.smsRu || tpl?.bodyRu || fallback).trim();
}

export const WELCOME_TEMPLATE_ID = 'tpl_welcome';

export const WELCOME_SMS_RU =
  '{firstName}, подробнее в нашем Telegram: {link}';
export const WELCOME_SMS_UZ =
  '{firstName}, batafsil Telegramda: {link}';

export function smsChars(text: string) {
  return [...text].length;
}

export const SMS_SAMPLE_VARS: Record<string, string> = {
  firstName: 'Александр',
  fullName: 'Александр Петров',
  orderTitle: 'Очки для дали',
  amount: '300 000 сум',
  opticsName: 'Оптика Юнусабад',
  address: 'ул. Амира Темура 12',
  hours: '9:00-20:00',
  phone: '+998 90 123 45 67',
  link: 'https://t.me/myoptika_bot',
};

export const DEFAULT_SMS_CHAR_LIMIT = 70;
export const MIN_SMS_CHAR_LIMIT = 40;
export const MAX_SMS_CHAR_LIMIT = 280;

export function clampSmsCharLimit(value?: number | null) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SMS_CHAR_LIMIT;
  return Math.min(MAX_SMS_CHAR_LIMIT, Math.max(MIN_SMS_CHAR_LIMIT, n));
}

export function smsLimitOf(limit?: number | null) {
  return clampSmsCharLimit(limit);
}

export function smsOverflow(template: string, limit?: number | null) {
  const raw = template.trim();
  if (!raw) return null;
  const filled = renderTemplate(raw, SMS_SAMPLE_VARS);
  const cap = smsLimitOf(limit);
  const chars = smsChars(filled);
  if (chars <= cap) return null;
  return { chars, limit: cap, filled };
}

export function fitSms(text: string, max = DEFAULT_SMS_CHAR_LIMIT, keepSuffix = '') {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const suffix = keepSuffix && trimmed.endsWith(keepSuffix) ? keepSuffix : '';
  const head = suffix ? trimmed.slice(0, trimmed.length - suffix.length).trimEnd() : trimmed;
  const budget = suffix ? Math.max(0, max - smsChars(suffix) - (head ? 1 : 0)) : max;
  if (smsChars(head) <= budget) {
    return suffix ? (head ? `${head} ${suffix}` : suffix) : head;
  }
  const cut = [...head].slice(0, Math.max(0, budget - 1)).join('').trimEnd();
  const short = cut ? `${cut}…` : '';
  return suffix ? (short ? `${short} ${suffix}` : suffix) : short;
}


