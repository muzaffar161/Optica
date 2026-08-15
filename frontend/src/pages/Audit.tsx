import { useEffect, useState } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import { useAuth } from '../AuthContext'
import Pagination from '../components/Pagination'
import { formatDate, featuresOf } from '../types'

const ACTION: Record<string, string> = {
  'auth.login': 'Вход',
  'order.create': 'Заказ создан',
  'order.status': 'Статус заказа',
  'order.update': 'Заказ изменён',
  'order.delete': 'Заказ удалён',
  'client.create': 'Клиент создан',
  'client.update': 'Клиент изменён',
  'client.delete': 'Клиент удалён',
  'staff.create': 'Сотрудник добавлен',
  'staff.update': 'Сотрудник изменён',
  'staff.move': 'Перевод в филиал',
  'branch.create': 'Филиал создан',
  'branch.update': 'Филиал изменён',
  'branch.delete': 'Филиал удалён',
  'settings.update': 'Настройки',
  'export.orders': 'Экспорт заказов',
  'export.clients': 'Экспорт клиентов',
}

type Row = {
  id: string
  username: string
  action: string
  summary: string
  createdAt: string
  opticsId: string | null
  meta: unknown
}

export default function AuditPage() {
  const toast = useToast()
  const { user } = useAuth()
  const features = featuresOf(user)
  const [items, setItems] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [salons, setSalons] = useState<{ id: string; name: string }[]>([])
  const [salonId, setSalonId] = useState('')

  async function load(next = 1, opticsId = salonId) {
    const params = new URLSearchParams({ page: String(next), pageSize: '50' })
    if (opticsId) params.set('opticsId', opticsId)
    const data = await api<{ items: Row[]; total: number; page: number; salons?: { id: string; name: string }[] }>(
      `/audit?${params}`,
    )
    setItems(data.items)
    setTotal(data.total)
    setPage(data.page)
    setSalons(data.salons || [])
  }

  useEffect(() => {
    load(1).catch((err: Error) => toast(err.message, 'err'))
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div>
        <h1 className="font-display text-3xl">Журнал действий</h1>
        <p className="mt-1 text-sm text-muted">
          {features.auditLevel === 'extended'
            ? 'Расширенный лог по сети: кто что менял'
            : 'Кто создавал и менял заказы, клиентов и настройки'}
        </p>
      </div>
      {features.auditLevel === 'extended' && salons.length > 1 && (
        <select
          value={salonId}
          onChange={(e) => {
            setSalonId(e.target.value)
            load(1, e.target.value).catch((err: Error) => toast(err.message, 'err'))
          }}
          className="rounded-xl border border-line px-3 py-2.5 text-sm"
        >
          <option value="">Все салоны</option>
          {salons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted">Пока пусто</div>}
        {items.map((row) => (
          <div key={row.id} className="px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <div>{ACTION[row.action] || row.action}</div>
              <div className="text-xs text-muted">{formatDate(row.createdAt)}</div>
            </div>
            <div className="text-xs text-muted">
              {row.username || 'система'}
              {row.summary ? ` · ${row.summary}` : ''}
            </div>
            {features.auditLevel === 'extended' && row.meta != null && (
              <pre className="mt-1 overflow-x-auto text-[11px] text-muted">{JSON.stringify(row.meta)}</pre>
            )}
          </div>
        ))}
      </div>
      <Pagination
        page={page}
        pageSize={50}
        total={total}
        onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
      />
    </div>
  )
}
