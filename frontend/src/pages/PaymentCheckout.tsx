import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import { formatSum } from '../types'
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  paymentStatusClass,
  type Payment,
  type PaymentMethod,
  type PaymentSettings,
} from '../payment'

export default function PaymentCheckoutPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('CLICK')
  const [payerName, setPayerName] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!id) return
    const [row, conf] = await Promise.all([
      api<Payment>(`/billing/payments/${id}`),
      api<PaymentSettings>('/billing/payment-settings'),
    ])
    setPayment(row)
    setSettings(conf)
    const enabled = enabledMethods(conf)
    if (row.paymentMethod && enabled.includes(row.paymentMethod)) {
      setMethod(row.paymentMethod)
    } else if (enabled[0]) {
      setMethod(enabled[0])
    }
    if (row.payerName) setPayerName(row.payerName)
    if (row.cardLast4) setCardLast4(row.cardLast4)
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setPending(true)
    setError('')
    try {
      const row = await api<Payment>(`/billing/payments/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: method,
          payerName: payerName.trim() || undefined,
          cardLast4: method === 'CARD_TRANSFER' ? cardLast4 : undefined,
        }),
      })
      setPayment(row)
      toast('Платёж отправлен на проверку')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка'
      setError(message)
      toast(message, 'err')
    } finally {
      setPending(false)
    }
  }

  if (!payment || !settings) return <p className="text-muted">Загрузка…</p>

  const amount = formatSum(payment.amount)
  const waiting = payment.status === 'WAITING_CONFIRMATION'
  const closed = payment.status === 'PAID' || payment.status === 'REJECTED' || payment.status === 'EXPIRED'
  const methods = enabledMethods(settings)

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <button type="button" onClick={() => navigate(-1)} className="text-sm text-muted hover:text-ink">
        ← Назад
      </button>
      {payment.status !== 'PENDING' && (
        <>
          <div>
            <h1 className="font-display text-3xl">Оплата</h1>
            <p className="mt-1 text-sm text-muted">{payment.purpose}</p>
          </div>
          <section className="rounded-2xl border border-line bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted">Номер платежа</div>
            <div className="font-display text-2xl">{payment.paymentNumber}</div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted">Сумма</div>
                <div className="font-display text-xl">{amount}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${paymentStatusClass(payment.status)}`}>
                {PAYMENT_STATUS_LABEL[payment.status]}
              </span>
            </div>
          </section>
        </>
      )}

      {payment.status === 'PAID' && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          Оплата подтверждена. Подписка или SMS уже начислены.
          <div className="mt-3">
            <Link to="/billing" className="underline">
              К подписке
            </Link>
          </div>
        </section>
      )}

      {payment.status === 'REJECTED' && (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Платёж отклонён{payment.rejectionReason ? `: ${payment.rejectionReason}` : '.'}
        </section>
      )}

      {payment.status === 'EXPIRED' && (
        <section className="rounded-2xl border border-line bg-card px-5 py-4 text-sm text-muted">
          Срок оплаты истёк. Создайте новый платёж.
        </section>
      )}

      {waiting && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <div className="font-display text-xl">Платёж отправлен на проверку</div>
          <p className="mt-2 text-sm text-muted">
            Номер {payment.paymentNumber}. Ожидайте подтверждения оплаты.
          </p>
          {payment.paymentMethod && (
            <p className="mt-2 text-sm">
              Способ: {PAYMENT_METHOD_LABEL[payment.paymentMethod]}
              {payment.payerName ? ` · ${payment.payerName}` : ''}
              {payment.cardLast4 ? ` · ****${payment.cardLast4}` : ''}
            </p>
          )}
        </section>
      )}

      {payment.status === 'PENDING' && (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-card p-5">
          {methods.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {methods.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMethod(item)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    method === item ? 'bg-ink text-white' : 'border border-line'
                  }`}
                >
                  {PAYMENT_METHOD_LABEL[item]}
                </button>
              ))}
            </div>
          )}

          {methods.length === 0 && (
            <p className="text-sm text-red-700">Сейчас нет доступных способов оплаты. Напишите в поддержку.</p>
          )}

          {method === 'CLICK' && methods.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl">Оплата через Click</h2>
                <p className="mt-1 text-sm text-muted">{payment.purpose}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  Сумма: <span className="font-medium">{amount}</span>
                </p>
                <p>
                  Платёж: <span className="font-medium">{payment.paymentNumber}</span>
                </p>
              </div>
              {settings.clickQrPath ? (
                <img
                  src={settings.clickQrPath}
                  alt="QR Click"
                  className="mx-auto max-h-64 rounded-2xl border border-line bg-white p-3"
                />
              ) : (
                <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-line bg-paper text-sm text-muted">
                  QR-код
                </div>
              )}
              {settings.clickInstructions && (
                <p className="text-sm text-muted">{settings.clickInstructions}</p>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Имя плательщика</span>
                <input
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5"
                />
              </label>
              <p className="text-sm text-muted">После оплаты нажмите:</p>
            </div>
          )}

          {method === 'CARD_TRANSFER' && methods.length > 0 && (
            <div className="space-y-3 text-sm">
              <div className="font-display text-2xl">Перевод на карту</div>
              {settings.cardOwner && (
                <p>
                  Получатель: <span className="font-medium">{settings.cardOwner}</span>
                </p>
              )}
              {settings.cardNumber && (
                <p>
                  Карта: <span className="font-medium">{settings.cardNumber}</span>
                </p>
              )}
              <p>
                Сумма: <span className="font-medium">{amount}</span>
              </p>
              <p>
                Платёж: <span className="font-medium">{payment.paymentNumber}</span>
              </p>
              {settings.cardInstructions && <p className="text-muted">{settings.cardInstructions}</p>}
              <label className="block">
                <span className="mb-1 block text-muted">Имя плательщика</span>
                <input
                  required
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-muted">Последние 4 цифры вашей карты</span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={4}
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full rounded-xl border border-line px-3 py-2.5"
                  placeholder="1234"
                />
                <span className="mt-1 block text-xs text-muted">
                  Полный номер, CVV и срок карты не нужны и не сохраняются.
                </span>
              </label>
              <p className="text-muted">После оплаты нажмите:</p>
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={pending || closed || methods.length === 0}
            className="w-full rounded-xl bg-ink py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Отправляем…' : 'Я оплатил'}
          </button>
        </form>
      )}
    </div>
  )
}

function enabledMethods(settings: PaymentSettings): PaymentMethod[] {
  const items: PaymentMethod[] = []
  if (settings.clickEnabled !== false) items.push('CLICK')
  if (settings.cardEnabled !== false) items.push('CARD_TRANSFER')
  return items
}
