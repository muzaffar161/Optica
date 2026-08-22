export type PaymentType = 'SUBSCRIPTION' | 'SMS_PACKAGE'
export type PaymentMethod = 'CLICK' | 'CARD_TRANSFER'
export type PaymentStatus =
  | 'PENDING'
  | 'WAITING_CONFIRMATION'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'

export type PaymentSettings = {
  clickInstructions: string
  clickQrPath: string
  clickAccount: string
  cardInstructions: string
  cardNumber: string
  cardOwner: string
  paymentExpireHours: number
  clickEnabled: boolean
  cardEnabled: boolean
  adminAlertPhone?: string
  adminAlertVia?: 'auto' | 'sms' | 'telegram'
  adminTelegramLinked?: boolean
}

export type Payment = {
  id: string
  paymentNumber: string
  organizationId: string
  organization?: { id: string; name: string }
  type: PaymentType
  planId: string | null
  plan?: {
    id: string
    name: string
    billingPeriod: string
    includedSms: number
    price: number
  } | null
  smsPackageId: string | null
  smsPackage?: { id: string; name: string; smsCount: number; price: number } | null
  amount: number
  currency: string
  paymentMethod: PaymentMethod | null
  status: PaymentStatus
  payerName: string | null
  cardLast4: string | null
  comment: string | null
  createdAt: string
  paidAt: string | null
  rejectedAt: string | null
  expiresAt: string | null
  confirmedBy: string | null
  rejectionReason: string | null
  purpose: string
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Ожидает оплаты',
  WAITING_CONFIRMATION: 'На проверке',
  PAID: 'Оплачен',
  REJECTED: 'Отклонён',
  EXPIRED: 'Истёк',
}

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  SUBSCRIPTION: 'Подписка',
  SMS_PACKAGE: 'SMS-пакет',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CLICK: 'Click',
  CARD_TRANSFER: 'Перевод на карту',
}

export function paymentStatusClass(status: PaymentStatus) {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-800'
    case 'WAITING_CONFIRMATION':
      return 'bg-amber-50 text-amber-800'
    case 'REJECTED':
      return 'bg-red-50 text-red-800'
    case 'EXPIRED':
      return 'bg-stone-100 text-stone-600'
    default:
      return 'bg-sky-50 text-sky-800'
  }
}
