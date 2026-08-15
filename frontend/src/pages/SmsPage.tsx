import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import Pagination from '../components/Pagination'
import { formatDate, formatSum } from '../types'
import type { Payment } from '../payment'

const TX_LABEL: Record<string, string> = {
  SUBSCRIPTION_BONUS: 'По подписке',
  PACKAGE_PURCHASE: 'Пакет',
  MESSAGE_SENT: 'Отправка SMS',
  REFUND: 'Возврат',
  ADJUSTMENT: 'Корректировка',
}

type Pack = { id: string; name: string; smsCount: number; price: number; currency: string }
type Tx = {
  id: string
  amount: number
  type: string
  description: string
  balanceAfter: number
  createdAt: string
}

export default function SmsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    balance: 0,
    sent: 0,
    subscriptionBonus: 0,
    purchased: 0,
  })
  const [packs, setPacks] = useState<Pack[]>([])
  const [items, setItems] = useState<Tx[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function load(next = 1) {
    const [s, p, tx] = await Promise.all([
      api<typeof stats>('/sms/balance'),
      api<Pack[]>('/sms/packages'),
      api<{ items: Tx[]; total: number; page: number }>(`/sms/transactions?page=${next}&pageSize=50`),
    ])
    setStats(s)
    setPacks(p)
    setItems(tx.items)
    setTotal(tx.total)
    setPage(tx.page)
  }

  useEffect(() => {
    load(1).catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function buy(id: string) {
    setPendingId(id)
    try {
      const row = await api<Payment>(`/sms/packages/${id}/purchase`, { method: 'POST' })
      toast('Создан платёж — оплатите пакет')
      navigate(`/billing/payments/${row.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <h1 className="font-display text-3xl">SMS</h1>
      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="font-display text-2xl">{stats.balance} SMS</div>
        <p className="mt-1 text-sm text-muted">
          Списывается только SMS. Telegram остаётся бесплатным.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted">Отправлено</div>
            {stats.sent}
          </div>
          <div>
            <div className="text-xs text-muted">По подписке</div>
            {stats.subscriptionBonus}
          </div>
          <div>
            <div className="text-xs text-muted">Куплено</div>
            {stats.purchased}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="font-display text-xl">Пакеты</div>
        {packs.map((pack) => (
          <div
            key={pack.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4"
          >
            <div>
              <div className="font-medium">{pack.name}</div>
              <div className="text-sm text-muted">
                {pack.smsCount} SMS · {formatSum(pack.price)}
              </div>
            </div>
            <button
              type="button"
              disabled={pendingId === pack.id}
              onClick={() => buy(pack.id)}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pendingId === pack.id ? 'Создаём…' : 'Оплатить'}
            </button>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="px-4 py-3 font-display text-xl">История</div>
        <div className="divide-y divide-line">
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted">Пока пусто</div>
          )}
          {items.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div>{TX_LABEL[row.type] || row.type}</div>
                <div className="text-xs text-muted">{row.description}</div>
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
        <Pagination
          page={page}
          pageSize={50}
          total={total}
          onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </section>
    </div>
  )
}
