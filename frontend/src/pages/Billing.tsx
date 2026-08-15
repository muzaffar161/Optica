import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import { formatSum } from '../types'
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
  paymentStatusClass,
  type Payment,
} from '../payment'

type Plan = {
  id: string
  name: string
  description: string
  price: number
  currency: string
  billingPeriod: string
  maxSalons: number
  maxEmployees: number
  includedSms: number
  statsLevel?: string
  auditLevel?: string
  canExport?: boolean
  advancedRoles?: boolean
  apiAccess?: boolean
  prioritySupport?: boolean
  recommended?: boolean
}

type Billing = {
  plan: Plan | null
  subscription: { status: string; startedAt: string; expiresAt: string } | null
  salonCount: number
  employeeCount: number
  smsBalance: number
  plans: Plan[]
  payments?: Payment[]
}

function periodLabel(period: string) {
  return period === 'year' ? 'год' : 'месяц'
}

function highlights(plan: Plan) {
  const items = [
    plan.maxSalons === 1 ? '1 филиал' : `до ${plan.maxSalons} филиалов`,
    plan.maxEmployees > 0 ? `до ${plan.maxEmployees} сотрудников` : 'сотрудники без лимита',
    `${plan.includedSms} SMS в тарифе`,
  ]
  if (plan.statsLevel === 'network') items.push('Отчёты по всей сети')
  else if (plan.statsLevel === 'extended') items.push('Расширенная статистика')
  else items.push('Базовая статистика')
  if (plan.auditLevel === 'extended') items.push('Расширенный журнал действий')
  else if (plan.auditLevel !== 'none') items.push('Журнал действий')
  if (plan.canExport) items.push('Экспорт данных')
  if (plan.advancedRoles) items.push('Гибкие права')
  if (plan.apiAccess) items.push('API')
  if (plan.prioritySupport) items.push('Приоритетная поддержка')
  return items
}

function blockedReason(plan: Plan, salonCount: number, employeeCount: number) {
  if (salonCount > plan.maxSalons) {
    return `Сначала уберите филиалы: сейчас ${salonCount}, в тарифе ${plan.maxSalons}`
  }
  if (plan.maxEmployees > 0 && employeeCount > plan.maxEmployees) {
    return `Слишком много сотрудников для этого тарифа`
  }
  return null
}

export default function BillingPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<Billing | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function load() {
    setData(await api<Billing>('/billing'))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function pay(plan: Plan) {
    setPendingId(plan.id)
    try {
      const row = await api<Payment>('/billing/payments', {
        method: 'POST',
        body: JSON.stringify({ type: 'SUBSCRIPTION', planId: plan.id }),
      })
      navigate(`/billing/payments/${row.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPendingId(null)
    }
  }

  if (!data) return <p className="text-muted">Загрузка…</p>
  const current = data.plan

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <h1 className="font-display text-3xl">Подписка</h1>
        <p className="mt-1 text-sm text-muted">
          Выберите тариф. Филиалы добавляются в разделе «Филиалы».
        </p>
      </div>

      {current && (
        <section className="rounded-2xl border border-line bg-card px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Сейчас</div>
              <div className="font-display text-2xl">{current.name}</div>
              <div className="text-sm text-muted">
                {formatSum(current.price)} / {periodLabel(current.billingPeriod)}
                {data.subscription
                  ? ` · до ${new Date(data.subscription.expiresAt).toLocaleDateString('ru-RU')}`
                  : ''}
              </div>
            </div>
            <div className="text-sm text-muted">
              {data.salonCount} фил. · {data.employeeCount} сотр. · {data.smsBalance} SMS
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {data.plans.map((plan) => {
          const active = current?.id === plan.id
          const upgrade = !current || plan.price > current.price
          const blocked = blockedReason(plan, data.salonCount, data.employeeCount)
          const popular = !!plan.recommended && !active
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-5 ${
                active
                  ? 'border-ink bg-card shadow-sm'
                  : popular
                    ? 'border-brass/60 bg-card'
                    : 'border-line bg-card'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-5 rounded-full bg-ink px-3 py-1 text-[11px] text-white">
                  Рекомендуем
                </div>
              )}
              {active && (
                <div className="absolute -top-3 left-5 rounded-full bg-emerald-700 px-3 py-1 text-[11px] text-white">
                  Ваш тариф
                </div>
              )}
              <div className="font-display text-2xl">{plan.name}</div>
              <div className="mt-1">
                <span className="font-display text-3xl">{formatSum(plan.price)}</span>
                <span className="text-sm text-muted"> / {periodLabel(plan.billingPeriod)}</span>
              </div>
              {plan.description && (
                <p className="mt-2 text-sm text-muted">{plan.description}</p>
              )}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {highlights(plan).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-emerald-700">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {active ? (
                <button
                  type="button"
                  disabled={pendingId === plan.id}
                  onClick={() => pay(plan)}
                  className="mt-5 w-full rounded-xl border border-line py-2.5 text-sm"
                >
                  {pendingId === plan.id ? 'Создаём…' : 'Продлить'}
                </button>
              ) : blocked ? (
                <div className="mt-5 rounded-xl border border-dashed border-line px-3 py-2.5 text-center text-xs text-muted">
                  {blocked}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === plan.id}
                  onClick={() => pay(plan)}
                  className={`mt-5 w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 ${
                    upgrade
                      ? 'bg-ink text-white'
                      : 'border border-line bg-paper text-ink'
                  }`}
                >
                  {pendingId === plan.id ? 'Создаём…' : upgrade ? 'Оплатить' : 'Понизить'}
                </button>
              )}
            </article>
          )
        })}
      </section>

      <p className="text-center text-xs text-muted">
        Telegram безлимитный. С баланса списывается только SMS. Оплата вручную через Click или перевод на карту.
      </p>

      <PaymentHistory items={data.payments || []} />
    </div>
  )
}

function PaymentHistory({ items }: { items: Payment[] }) {
  const subs = items.filter((row) => row.type === 'SUBSCRIPTION')
  const sms = items.filter((row) => row.type === 'SMS_PACKAGE')
  if (items.length === 0) return null
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HistoryBlock title="История подписки" items={subs} />
      <HistoryBlock title="Покупки SMS" items={sms} />
    </div>
  )
}

function HistoryBlock({ title, items }: { title: string; items: Payment[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="px-4 py-3 font-display text-xl">{title}</div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-sm text-muted">Пока пусто</div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((row) => (
            <Link
              key={row.id}
              to={`/billing/payments/${row.id}`}
              className="flex items-start justify-between gap-3 px-4 py-3 text-sm hover:bg-paper/60"
            >
              <div>
                <div className="font-medium">{row.paymentNumber}</div>
                <div className="text-xs text-muted">
                  {row.purpose} · {PAYMENT_TYPE_LABEL[row.type]}
                </div>
              </div>
              <div className="text-right">
                <div>{formatSum(row.amount)}</div>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${paymentStatusClass(row.status)}`}>
                  {PAYMENT_STATUS_LABEL[row.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
