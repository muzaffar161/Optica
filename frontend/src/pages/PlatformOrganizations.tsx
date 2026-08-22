import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import { formatDate, formatSum } from '../types'

type Plan = {
  id: string
  name: string
  price: number
  billingPeriod: string
  maxSalons: number
  maxEmployees: number
  includedSms: number
  isActive: boolean
}

type OrgRow = {
  id: string
  name: string
  smsBalance: number
  _count: { optics: number }
  plan: Plan | null
  optics: { id: string; name: string; active: boolean }[]
}

type Tx = {
  id: string
  amount: number
  type: string
  description: string
  balanceAfter: number
  createdAt: string
}

type OrgDetail = OrgRow & {
  salonCount: number
  employeeCount: number
  smsBalance: number
  subscription: { status: string; expiresAt: string } | null
  transactions: Tx[]
  optics: {
    id: string
    name: string
    active: boolean
    users: { id: string; username: string; isOwner: boolean; orgOwner: boolean }[]
  }[]
}

const TX_LABEL: Record<string, string> = {
  SUBSCRIPTION_BONUS: 'По подписке',
  PACKAGE_PURCHASE: 'Пакет',
  MESSAGE_SENT: 'Отправка SMS',
  REFUND: 'Возврат',
  ADJUSTMENT: 'Корректировка',
}

export default function PlatformOrganizations() {
  const toast = useToast()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrgDetail | null>(null)
  const [planId, setPlanId] = useState('')
  const [smsAmount, setSmsAmount] = useState(0)
  const [smsReason, setSmsReason] = useState('')
  const [addSalon, setAddSalon] = useState(false)
  const [salonName, setSalonName] = useState('')
  const [salonUser, setSalonUser] = useState('')
  const [salonPass, setSalonPass] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const [list, p] = await Promise.all([
      api<OrgRow[]>('/platform/organizations'),
      api<Plan[]>('/platform/plans'),
    ])
    setOrgs(list)
    setPlans(p)
  }

  async function loadDetail(id: string) {
    const row = await api<OrgDetail>(`/platform/organizations/${id}`)
    setDetail(row)
    setPlanId(row.plan?.id || '')
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function open(id: string) {
    setOpenId(id)
    setAddSalon(false)
    setSmsAmount(0)
    setSmsReason('')
    try {
      await loadDetail(id)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function assign(e: FormEvent) {
    e.preventDefault()
    if (!openId || !planId) return
    setPending(true)
    try {
      await api(`/platform/organizations/${openId}/plan`, {
        method: 'POST',
        body: JSON.stringify({ planId }),
      })
      toast('Тариф назначен, SMS по тарифу начислены')
      await Promise.all([load(), loadDetail(openId)])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function adjust(e: FormEvent) {
    e.preventDefault()
    if (!openId) return
    setPending(true)
    try {
      await api(`/platform/organizations/${openId}/sms/adjust`, {
        method: 'POST',
        body: JSON.stringify({ amount: smsAmount, reason: smsReason }),
      })
      toast('Баланс SMS обновлён')
      setSmsAmount(0)
      setSmsReason('')
      await Promise.all([load(), loadDetail(openId)])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function createSalon(e: FormEvent) {
    e.preventDefault()
    if (!openId) return
    setPending(true)
    try {
      await api(`/platform/organizations/${openId}/optics`, {
        method: 'POST',
        body: JSON.stringify({
          name: salonName,
          username: salonUser,
          password: salonPass,
        }),
      })
      toast('Салон добавлен в сеть')
      setAddSalon(false)
      setSalonName('')
      setSalonUser('')
      setSalonPass('')
      await Promise.all([load(), loadDetail(openId)])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-6">
        <h1 className="font-display text-3xl">Подписки</h1>
        <p className="mt-1 text-sm text-muted">
          Тариф принадлежит организации. SMS на её баланс выдаются с общего счёта (меню SMS).
        </p>
      </div>
      <div className="space-y-3">
        {orgs.map((org) => (
          <article key={org.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{org.name}</div>
                <div className="mt-1 text-sm text-muted">
                  {org.plan ? org.plan.name : 'без тарифа'} · {org._count.optics} сал. · {org.smsBalance} SMS
                </div>
              </div>
              <button type="button" onClick={() => open(org.id)} className="text-sm text-ink hover:underline">
                Открыть
              </button>
            </div>
          </article>
        ))}
        {orgs.length === 0 && (
          <p className="text-sm text-muted">Организаций пока нет — создайте салон, появится и подписка.</p>
        )}
      </div>

      {openId && detail && (
        <Modal title={detail.name} onClose={() => { setOpenId(null); setDetail(null) }} wide>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>Салоны: {detail.salonCount}{detail.plan ? ` / ${detail.plan.maxSalons}` : ''}</div>
              <div>
                Сотрудники: {detail.employeeCount}
                {detail.plan?.maxEmployees ? ` / ${detail.plan.maxEmployees}` : ' · без лимита'}
              </div>
              <div>Баланс SMS: {detail.smsBalance}</div>
              {detail.subscription && (
                <div className="text-muted">
                  До {new Date(detail.subscription.expiresAt).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>

            <form onSubmit={assign} className="space-y-2">
              <span className="block text-sm text-muted">Тариф</span>
              <div className="flex gap-2">
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 outline-none"
                >
                  <option value="">Выберите</option>
                  {plans.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatSum(p.price)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending || !planId}
                  className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  Назначить
                </button>
              </div>
            </form>

            <form onSubmit={adjust} className="space-y-2">
              <span className="block text-sm text-muted">
                Выдать с общего счёта (+) или вернуть (−)
              </span>
              <input
                type="number"
                value={smsAmount}
                onChange={(e) => setSmsAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                placeholder="например 50 или -10"
              />
              <input
                required
                minLength={2}
                value={smsReason}
                onChange={(e) => setSmsReason(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                placeholder="Причина"
              />
              <button
                type="submit"
                disabled={pending || smsAmount === 0}
                className="w-full rounded-xl border border-line py-2.5 text-sm disabled:opacity-60"
              >
                Изменить баланс
              </button>
            </form>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm text-muted">Салоны сети</div>
                {detail.plan && detail.salonCount < detail.plan.maxSalons && (
                  <button type="button" onClick={() => setAddSalon(true)} className="text-sm text-ink hover:underline">
                    Добавить салон
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {detail.optics.map((shop) => (
                  <div key={shop.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                    <div>{shop.name}</div>
                    <div className="text-xs text-muted">
                      {shop.users.map((u) => `${u.username}${u.orgOwner ? ' · сеть' : ''}`).join(', ') || 'без логина'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm text-muted">Последние SMS-операции</div>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {detail.transactions.length === 0 && <p className="text-sm text-muted">Пока пусто</p>}
                {detail.transactions.map((row) => (
                  <div key={row.id} className="flex justify-between gap-3 text-sm">
                    <div>
                      <div>{TX_LABEL[row.type] || row.type}</div>
                      <div className="text-xs text-muted">{row.description || formatDate(row.createdAt)}</div>
                    </div>
                    <div className={row.amount > 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {row.amount > 0 ? '+' : ''}
                      {row.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {addSalon && openId && (
        <Modal title="Салон в эту сеть" onClose={() => setAddSalon(false)}>
          <form onSubmit={createSalon} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название</span>
              <input
                required
                minLength={2}
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Логин салона</span>
              <input
                required
                minLength={3}
                value={salonUser}
                onChange={(e) => setSalonUser(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Пароль</span>
              <input
                required
                minLength={8}
                type="password"
                value={salonPass}
                onChange={(e) => setSalonPass(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Создаём…' : 'Создать'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
