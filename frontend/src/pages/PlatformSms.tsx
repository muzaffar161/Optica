import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import { formatDate } from '../types'

type Bowl = {
  organizationId: string
  name: string
  salons: number
  balance: number
  sentMonth: number
}

type Tx = {
  id: string
  amount: number
  type: string
  kind: string
  organizationId: string
  description: string
  balanceAfter: number
  createdAt: string
}

type Snapshot = {
  balance: number
  inBowls: number
  welcomeMonth: number
  bowls: Bowl[]
  transactions: Tx[]
}

const KIND: Record<string, string> = {
  stock: 'На общий счёт',
  allocate: 'Выдано салону',
  reclaim: 'Возврат на общий счёт',
  welcome: 'Приветствие',
}

export default function PlatformSms() {
  const toast = useToast()
  const [data, setData] = useState<Snapshot | null>(null)
  const [delta, setDelta] = useState('')
  const [pourOrg, setPourOrg] = useState('')
  const [pourAmount, setPourAmount] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const row = await api<Snapshot>('/platform/product-sms')
    setData(row)
    if (!pourOrg && row.bowls[0]) setPourOrg(row.bowls[0].organizationId)
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function stock(e: FormEvent) {
    e.preventDefault()
    const amount = Number(delta)
    if (!amount) return
    setPending(true)
    try {
      const saved = await api<Snapshot>('/platform/product-sms', {
        method: 'PATCH',
        body: JSON.stringify({
          amount,
          reason: amount > 0 ? 'Закупка SMS у провайдера' : 'Списание из общего запаса',
        }),
      })
      setData(saved)
      setDelta('')
      toast(amount > 0 ? `На общий счёт +${amount}` : `С общего счёта ${amount}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function pour(e: FormEvent) {
    e.preventDefault()
    if (!pourOrg) return
    const amount = Number(pourAmount)
    if (!amount) return
    setPending(true)
    try {
      await api(`/platform/organizations/${pourOrg}/sms/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          reason:
            amount > 0
              ? `Выдано ${amount} SMS с общего счёта`
              : `Возврат ${Math.abs(amount)} SMS на общий счёт`,
        }),
      })
      setPourAmount('')
      await load()
      toast(amount > 0 ? 'Выдано салону' : 'Вернули на общий счёт')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  const bowlName = (id: string) => data?.bowls.find((row) => row.organizationId === id)?.name

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl">SMS</h1>
        <p className="mt-1 text-sm text-muted">
          Общий счёт — ваш запас у провайдера. С него выдаёте SMS организациям. Салон тратит со
          своего баланса. Приветствие списывается сразу с общего счёта.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Общий счёт</div>
          <div className="mt-1 font-display text-3xl">{data?.balance ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted">У салонов</div>
          <div className="mt-1 font-display text-3xl">{data?.inBowls ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Приветствия в этом месяце</div>
          <div className="mt-1 font-display text-3xl">{data?.welcomeMonth ?? 0}</div>
        </div>
      </section>

      <form onSubmit={stock} className="rounded-2xl border border-line bg-card p-5">
        <div className="font-medium">Закупка у провайдера</div>
        <p className="mt-1 text-sm text-muted">Купили 100 SMS — поставьте +100. Это только общий счёт.</p>
        <div className="mt-3 flex gap-2">
          <input
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="+100 или -10"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 outline-none"
          />
          <button
            type="submit"
            disabled={pending || !Number(delta)}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            Положить
          </button>
        </div>
      </form>

      <form onSubmit={pour} className="rounded-2xl border border-line bg-card p-5">
        <div className="font-medium">Выдать салону / вернуть</div>
        <p className="mt-1 text-sm text-muted">
          Плюс — с общего счёта на баланс организации. Минус — обратно, если у салона ещё есть остаток.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <select
            value={pourOrg}
            onChange={(e) => setPourOrg(e.target.value)}
            className="rounded-xl border border-line px-3 py-2.5 outline-none"
          >
            {(data?.bowls || []).map((bowl) => (
              <option key={bowl.organizationId} value={bowl.organizationId}>
                {bowl.name} · {bowl.balance} SMS
              </option>
            ))}
          </select>
          <input
            inputMode="numeric"
            value={pourAmount}
            onChange={(e) => setPourAmount(e.target.value)}
            placeholder="50 или -10"
            className="rounded-xl border border-line px-3 py-2.5 outline-none"
          />
          <button
            type="submit"
            disabled={pending || !pourOrg || !Number(pourAmount)}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            Выдать
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="px-5 py-3 font-medium">Балансы салонов</div>
        <div className="divide-y divide-line">
          {(data?.bowls || []).length === 0 && (
            <div className="px-5 py-8 text-sm text-muted">Организаций пока нет</div>
          )}
          {(data?.bowls || []).map((bowl) => (
            <div key={bowl.organizationId} className="flex items-start justify-between gap-3 px-5 py-3">
              <div>
                <div className="font-medium">{bowl.name}</div>
                <div className="text-xs text-muted">
                  {bowl.salons} сал. · этот месяц отправили {bowl.sentMonth}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{bowl.balance}</div>
                <div className="text-xs text-muted">на балансе</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="px-5 py-3 font-medium">Общий счёт · журнал</div>
        <div className="divide-y divide-line">
          {(data?.transactions || []).length === 0 && (
            <div className="px-5 py-8 text-sm text-muted">Пока пусто</div>
          )}
          {(data?.transactions || []).map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <div>{KIND[row.kind] || row.description || row.type}</div>
                <div className="text-xs text-muted">{row.description}</div>
                {row.organizationId ? (
                  <div className="text-xs text-muted">{bowlName(row.organizationId)}</div>
                ) : null}
                <div className="text-xs text-muted">{formatDate(row.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className={row.amount > 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {row.amount > 0 ? '+' : ''}
                  {row.amount}
                </div>
                <div className="text-xs text-muted">остаток {row.balanceAfter}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted">
        Лимит символов и латиница — в{' '}
        <Link to="/platform/templates" className="text-ink underline">
          шаблонах
        </Link>
        .
      </p>
    </div>
  )
}
