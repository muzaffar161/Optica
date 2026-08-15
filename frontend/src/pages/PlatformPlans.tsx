import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import { formatSum } from '../types'

type Plan = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  billingPeriod: 'month' | 'year'
  maxSalons: number
  maxEmployees: number
  includedSms: number
  isActive: boolean
  statsLevel: 'basic' | 'extended' | 'network'
  auditLevel: 'none' | 'salon' | 'extended'
  canExport: boolean
  advancedRoles: boolean
  apiAccess: boolean
  prioritySupport: boolean
  recommended: boolean
}

const empty = {
  name: '',
  description: '',
  price: 0,
  billingPeriod: 'month' as const,
  maxSalons: 1,
  maxEmployees: 5,
  includedSms: 100,
  statsLevel: 'basic' as const,
  auditLevel: 'none' as const,
  canExport: false,
  advancedRoles: false,
  apiAccess: false,
  prioritySupport: false,
  recommended: false,
}

export default function PlatformPlans() {
  const toast = useToast()
  const [items, setItems] = useState<Plan[]>([])
  const [open, setOpen] = useState<Plan | 'new' | null>(null)
  const [form, setForm] = useState(empty)
  const [pending, setPending] = useState(false)

  async function load() {
    setItems(await api<Plan[]>('/platform/plans'))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  function start(plan?: Plan) {
    if (plan) {
      setOpen(plan)
      setForm({
        name: plan.name,
        description: plan.description,
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        maxSalons: plan.maxSalons,
        maxEmployees: plan.maxEmployees,
        includedSms: plan.includedSms,
        statsLevel: plan.statsLevel || 'basic',
        auditLevel: plan.auditLevel || 'none',
        canExport: !!plan.canExport,
        advancedRoles: !!plan.advancedRoles,
        apiAccess: !!plan.apiAccess,
        prioritySupport: !!plan.prioritySupport,
        recommended: !!plan.recommended,
      })
    } else {
      setOpen('new')
      setForm(empty)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      if (open === 'new') {
        await api('/platform/plans', { method: 'POST', body: JSON.stringify(form) })
        toast('Тариф создан')
      } else if (open && open !== 'new') {
        await api(`/platform/plans/${open.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
        toast('Тариф обновлён')
      }
      setOpen(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function toggle(plan: Plan) {
    await api(`/platform/plans/${plan.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !plan.isActive }),
    })
    await load()
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Тарифы</h1>
          <p className="mt-1 text-sm text-muted">Цены, лимиты и SMS хранятся в базе.</p>
        </div>
        <button
          type="button"
          onClick={() => start()}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white"
        >
          Создать тариф
        </button>
      </div>
      <div className="space-y-3">
        {items.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{plan.name}</div>
                <div className="text-sm text-muted">
                  {formatSum(plan.price)} / {plan.billingPeriod === 'year' ? 'год' : 'месяц'}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {plan.recommended && (
                  <span className="rounded-full bg-ink px-2 py-1 text-xs text-white">рекомендуем</span>
                )}
                <span className={`rounded-full px-2 py-1 text-xs ${plan.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                  {plan.isActive ? 'активен' : 'выкл'}
                </span>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted">
              {plan.maxSalons} сал. · {plan.maxEmployees > 0 ? `${plan.maxEmployees} сотр.` : 'сотрудники без лимита'} · {plan.includedSms} SMS
              <div className="mt-1">
                {plan.statsLevel === 'network' ? 'сеть' : plan.statsLevel === 'extended' ? 'расш. статистика' : 'баз. статистика'}
                {plan.canExport ? ' · экспорт' : ''}
                {plan.auditLevel !== 'none' ? ' · журнал' : ''}
                {plan.apiAccess ? ' · API' : ''}
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <button type="button" onClick={() => start(plan)} className="text-ink hover:underline">
                Изменить
              </button>
              <button type="button" onClick={() => toggle(plan)} className="text-muted hover:underline">
                {plan.isActive ? 'Выключить' : 'Включить'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <Modal title={open === 'new' ? 'Новый тариф' : 'Тариф'} onClose={() => setOpen(null)}>
          <form onSubmit={save} className="space-y-3">
            <Field label="Название" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <Field label="Описание" value={form.description} onChange={(description) => setForm({ ...form, description })} />
            <Field label="Цена, сум" type="number" value={String(form.price)} onChange={(v) => setForm({ ...form, price: Number(v) })} />
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Период</span>
              <select
                value={form.billingPeriod}
                onChange={(e) => setForm({ ...form, billingPeriod: e.target.value as 'month' | 'year' })}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              >
                <option value="month">месяц</option>
                <option value="year">год</option>
              </select>
            </label>
            <Field label="Салонов" type="number" value={String(form.maxSalons)} onChange={(v) => setForm({ ...form, maxSalons: Number(v) })} />
            <Field label="Сотрудников (0 = без лимита)" type="number" value={String(form.maxEmployees)} onChange={(v) => setForm({ ...form, maxEmployees: Number(v) })} />
            <Field label="SMS в тарифе" type="number" value={String(form.includedSms)} onChange={(v) => setForm({ ...form, includedSms: Number(v) })} />
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Статистика</span>
              <select value={form.statsLevel} onChange={(e) => setForm({ ...form, statsLevel: e.target.value as typeof form.statsLevel })} className="w-full rounded-xl border border-line px-3 py-2.5 outline-none">
                <option value="basic">базовая</option>
                <option value="extended">расширенная</option>
                <option value="network">по всей сети</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Журнал действий</span>
              <select value={form.auditLevel} onChange={(e) => setForm({ ...form, auditLevel: e.target.value as typeof form.auditLevel })} className="w-full rounded-xl border border-line px-3 py-2.5 outline-none">
                <option value="none">нет</option>
                <option value="salon">салон</option>
                <option value="extended">расширенный</option>
              </select>
            </label>
            {[
              ['canExport', 'Экспорт данных'],
              ['advancedRoles', 'Гибкие права'],
              ['apiAccess', 'API'],
              ['prioritySupport', 'Приоритетная поддержка'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[key as 'canExport'])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.recommended}
                onChange={(e) => setForm({ ...form, recommended: e.target.checked })}
              />
              <span>
                Рекомендуем
                <span className="mt-0.5 block text-xs text-muted">
                  Метка на карточке тарифа. Одновременно только у одного.
                </span>
              </span>
            </label>
            <button type="submit" disabled={pending} className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input
        required={type !== 'text' || label === 'Название'}
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
      />
    </label>
  )
}
