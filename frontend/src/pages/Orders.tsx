import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, downloadCsv } from '../api'
import { useToast } from '../Toast'
import { useAuth } from '../AuthContext'
import { canEdit } from '../access'
import {
  getCurrent,
  getHeld,
  hasContent,
  holdCurrent,
  removeHeld,
  resumeDraft,
  setCurrent,
  startNew,
  subscribeDrafts,
  type OrderDraft,
} from '../orderDraft'
import Pagination from '../components/Pagination'
import Highlight from '../components/Highlight'
import SearchBox from '../components/SearchBox'
import Select from '../components/Select'
import ArchiveTabs, { ArchiveAction } from '../components/ArchiveTabs'
import {
  STATUS_LABEL,
  formatDate,
  formatOrderPay,
  hasCatalog,
  hasRx,
  featuresOf,
  type Order,
  type OrderStatus,
  type Page,
} from '../types'
import { UZ_DEFAULT } from '../phone'
import { openDeviceSms, type DeviceSms } from '../deviceSms'

const PAGE_SIZE = 50

const FILTERS: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'new', label: 'Принято' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'ready', label: 'Готовы' },
  { value: 'picked_up', label: 'Выданы' },
  { value: 'cancelled', label: 'Отменены' },
]

function lastChannel(order: Order) {
  const last = order.notifications?.find((n) => n.status !== 'failed')
  return last?.channel ?? null
}

function statusClass(status: OrderStatus) {
  switch (status) {
    case 'new':
      return 'bg-sky-50 text-sky-800'
    case 'in_progress':
      return 'bg-amber-50 text-amber-800'
    case 'ready':
      return 'bg-emerald-50 text-emerald-800'
    case 'picked_up':
      return 'bg-stone-100 text-stone-600'
    case 'cancelled':
      return 'bg-red-50 text-red-800'
  }
}

function OrderPhotos({ order }: { order: Order }) {
  const photos = (order.items ?? []).filter((item) => item.photoPath).slice(0, 3)
  if (photos.length === 0) return null
  return (
    <div className="mt-1.5 flex -space-x-2">
      {photos.map((item) => (
        <img
          key={item.id}
          src={item.photoPath!}
          alt=""
          className="h-8 w-8 rounded-lg border border-card object-cover"
        />
      ))}
    </div>
  )
}

function DraftCard({
  draft,
  hint,
  onOpen,
  onRemove,
}: {
  draft: OrderDraft
  hint: string
  onOpen: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brass/40 bg-card p-3">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="truncate font-medium">{draft.label}</div>
        <div className="text-xs text-muted">
          {hint} ·{' '}
          {new Date(draft.updatedAt).toLocaleString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
      >
        Удалить
      </button>
    </div>
  )
}

function ParkedDrafts() {
  const navigate = useNavigate()
  const [held, setHeld] = useState<OrderDraft[]>(getHeld())
  const [current, setCurrentDraft] = useState<OrderDraft | null>(getCurrent())

  useEffect(
    () =>
      subscribeDrafts(() => {
        setHeld(getHeld())
        setCurrentDraft(getCurrent())
      }),
    [],
  )

  const unfinished = hasContent(current) ? current : null
  if (!unfinished && held.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted">Незавершённые</div>
      {unfinished && (
        <DraftCard
          draft={unfinished}
          hint="Нажмите, чтобы продолжить"
          onOpen={() => navigate('/new-order')}
          onRemove={() => setCurrent(null)}
        />
      )}
      {held.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          hint="Отложен · нажмите, чтобы продолжить"
          onOpen={() => {
            resumeDraft(draft.id)
            navigate('/new-order')
          }}
          onRemove={() => removeHeld(draft.id)}
        />
      ))}
    </div>
  )
}

export default function Orders() {
  const toast = useToast()
  const { user } = useAuth()
  const writable = canEdit(user, 'orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState({
    new: 0,
    in_progress: 0,
    ready: 0,
    cancelled: 0,
  })
  const [status, setStatus] = useState<'' | OrderStatus>('')
  const [q, setQ] = useState('')
  const [archive, setArchive] = useState(false)
  const [archiveAfterDays, setArchiveAfterDays] = useState(10)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deviceSms, setDeviceSms] = useState<DeviceSms | null>(null)

  async function load(nextPage = page) {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (q.trim()) query.set('q', q.trim())
    if (archive) query.set('archive', '1')
    query.set('page', String(nextPage))
    query.set('pageSize', String(PAGE_SIZE))
    const data = await api<
      Page<Order> & { counts?: Record<string, number>; archiveAfterDays?: number }
    >(`/orders?${query}`)
    setOrders(data.items)
    setTotal(data.total)
    setPage(data.page)
    if (data.archiveAfterDays) setArchiveAfterDays(data.archiveAfterDays)
    setCounts({
      new: data.counts?.new ?? 0,
      in_progress: data.counts?.in_progress ?? 0,
      ready: data.counts?.ready ?? 0,
      cancelled: data.counts?.cancelled ?? 0,
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(1).catch((err: Error) => toast(err.message, 'err'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [status, q, archive])

  function toastNotify(updated: Order) {
    if (updated.deviceSms?.messages?.length) {
      setDeviceSms(updated.deviceSms)
      toast('Откройте SMS и нажмите Отправить')
      return
    }
    const channel = lastChannel(updated)
    if (channel === 'telegram') toast('Отправлено в Telegram')
    else if (channel === 'sms') toast('SMS отправлено')
    else toast('Уведомление обработано')
  }

  async function changeStatus(order: Order, next: OrderStatus) {
    try {
      const updated = await api<Order>(`/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      if (next === 'ready' && order.status !== 'ready') {
        toastNotify(updated)
      }
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function notify(order: Order, resend = false) {
    setPendingId(order.id)
    try {
      const updated = await api<Order>(
        `/orders/${order.id}/${resend ? 'resend' : 'notify'}`,
        { method: 'POST' },
      )
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      toastNotify(updated)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPendingId(null)
    }
  }

  async function toggleArchive(order: Order) {
    try {
      await api<Order>(`/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !order.archived }),
      })
      toast(order.archived ? 'Вернули из архива' : 'В архиве')
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function cancelOrder(order: Order) {
    if (!window.confirm(`Отменить заказ для ${order.client.fullName}?`)) return
    try {
      await api<Order>(`/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })
      toast('Заказ отменён')
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  function OrderActions({ order }: { order: Order }) {
    const done = order.status === 'picked_up' || order.status === 'cancelled'
    return (
      <>
        {!done && order.status === 'ready' && (
          <button
            type="button"
            disabled={pendingId === order.id}
            onClick={() => notify(order, true)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-paper disabled:opacity-60"
          >
            Отправить снова
          </button>
        )}
        {!done && order.status !== 'ready' && (
          <button
            type="button"
            disabled={pendingId === order.id}
            onClick={() => notify(order)}
            className="rounded-lg bg-brass px-3 py-1.5 text-xs font-medium text-white hover:bg-brass-dark disabled:opacity-60"
          >
            Готов — уведомить
          </button>
        )}
        {!done && (
          <button
            type="button"
            onClick={() => cancelOrder(order)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Отменить
          </button>
        )}
        <ArchiveAction archived={order.archived} onToggle={() => toggleArchive(order)} />
      </>
    )
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl">Заказы</h1>
            <ArchiveTabs archive={archive} onChange={setArchive} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {archive
              ? `Вручную и старше ${archiveAfterDays} дн.`
              : q.trim()
                ? 'Поиск по актуальным и архиву'
                : `Принято ${counts.new} · в работе ${counts.in_progress} · готовы ${counts.ready}${
                    counts.cancelled ? ` · отменены ${counts.cancelled}` : ''
                  }`}
          </p>
        </div>
        {writable && (
          <div className="hidden items-center gap-2 md:flex">
            {featuresOf(user).canExport && (
              <button
                type="button"
                onClick={() =>
                  downloadCsv('/export/orders', 'orders.csv').catch((err: Error) => toast(err.message, 'err'))
                }
                className="rounded-xl border border-line px-4 py-2.5 text-sm"
              >
                Экспорт
              </button>
            )}
            <Link
              to="/new-order"
              onClick={() => {
                const catalog = hasCatalog(user)
                const rx = hasRx(user)
                if (catalog && rx) {
                  if (hasContent(getCurrent())) holdCurrent()
                  else setCurrent(null)
                  return
                }
                startNew(UZ_DEFAULT, rx && !catalog ? 'rx' : 'catalog')
              }}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-soft"
            >
              Новый заказ
            </Link>
          </div>
        )}
      </div>

      {writable && <ParkedDrafts />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              status === f.value
                ? 'bg-ink text-white'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
        <SearchBox
          value={q}
          onChange={setQ}
          onSubmit={() => load(1).catch((err: Error) => toast(err.message, 'err'))}
          placeholder="Имя, заказ или телефон"
          className="w-full md:ml-auto md:w-80"
        />
      </div>

      <div className="space-y-3 md:hidden">
        {orders.length === 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-16 text-center text-muted">
            {q.trim()
              ? 'Ничего не найдено — ни в актуальных, ни в архиве.'
              : archive
                ? 'В архиве пока пусто.'
                : 'Заказов пока нет — создайте первый.'}
          </div>
        )}
        {orders.map((order) => {
          const channel = lastChannel(order)
          return (
            <article key={order.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    <Highlight text={order.client.fullName} query={q} />
                  </div>
                  <div className="text-xs text-muted">
                    <Highlight text={order.client.phone} query={q} phone />
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  {formatDate(order.createdAt)}
                  {order.archived && (
                    <div className="mt-0.5 uppercase tracking-wide text-brass-dark">архив</div>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm">
                <Highlight text={order.title} query={q} />
                <OrderPhotos order={order} />
                {order.amount != null && (
                  <div className="mt-1 text-xs text-brass-dark">{formatOrderPay(order)}</div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {writable ? (
                  <Select
                    value={order.status}
                    onChange={(next) => changeStatus(order, next as OrderStatus)}
                    options={(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => ({
                      value: s,
                      label: STATUS_LABEL[s],
                    }))}
                    className="w-40"
                    triggerClassName={`rounded-full py-1 text-xs ${statusClass(order.status)}`}
                  />
                ) : (
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${statusClass(order.status)}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                )}
                <span className="text-xs text-muted">
                  {channel === 'telegram' && 'Telegram'}
                  {channel === 'sms' && 'SMS'}
                  {!channel && (order.client.telegramChatId ? 'TG готов' : 'только SMS')}
                </span>
                {writable && (
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <OrderActions order={order} />
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium">Заказ</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Канал</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted">
                    {q.trim()
                      ? 'Ничего не найдено — ни в актуальных, ни в архиве.'
                      : archive
                        ? 'В архиве пока пусто.'
                        : 'Заказов пока нет — создайте первый.'}
                  </td>
                </tr>
              )}
              {orders.map((order) => {
                const channel = lastChannel(order)
                return (
                  <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      <div>{formatDate(order.createdAt)}</div>
                      {order.archived && (
                        <div className="mt-0.5 text-[11px] uppercase tracking-wide text-brass-dark">
                          архив
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        <Highlight text={order.client.fullName} query={q} />
                      </div>
                      <div className="text-xs text-muted">
                        <Highlight text={order.client.phone} query={q} phone />
                      </div>
                      <div className="mt-1 text-[11px]">
                        {order.client.telegramChatId ? (
                          <span className="text-emerald-700">Telegram подключён</span>
                        ) : (
                          <span className="text-muted">только SMS</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Highlight text={order.title} query={q} />
                      <OrderPhotos order={order} />
                      {order.amount != null && (
                        <div className="mt-1 text-xs text-brass-dark">
                          {formatOrderPay(order)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {writable ? (
                        <Select
                          value={order.status}
                          onChange={(next) => changeStatus(order, next as OrderStatus)}
                          options={(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => ({
                            value: s,
                            label: STATUS_LABEL[s],
                          }))}
                          className="w-40"
                          triggerClassName={`rounded-full py-1 text-xs ${statusClass(order.status)}`}
                        />
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${statusClass(order.status)}`}
                        >
                          {STATUS_LABEL[order.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {channel === 'telegram' && 'Telegram'}
                      {channel === 'sms' && 'SMS'}
                      {!channel && '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {writable && (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <OrderActions order={order} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>

      <div className="md:hidden">
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>

      {writable && (
        <Link
          to="/new-order"
          onClick={() => {
            const catalog = hasCatalog(user)
            const rx = hasRx(user)
            if (catalog && rx) {
              if (hasContent(getCurrent())) holdCurrent()
              else setCurrent(null)
              return
            }
            startNew(UZ_DEFAULT, rx && !catalog ? 'rx' : 'catalog')
          }}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-2xl bg-ink py-3.5 text-center text-sm font-medium text-white shadow-lg md:hidden"
        >
          Новый заказ
        </Link>
      )}
      {deviceSms && (
        <DeviceSmsSheet draft={deviceSms} onClose={() => setDeviceSms(null)} />
      )}
    </div>
  )
}

function DeviceSmsSheet({
  draft,
  onClose,
}: {
  draft: DeviceSms
  onClose: () => void
}) {
  const body = draft.messages.filter(Boolean).join('\n\n')
  useEffect(() => {
    openDeviceSms(draft)
  }, [draft])
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-line bg-card px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="font-display text-2xl">SMS клиенту</div>
        <div className="mt-1 text-sm text-muted">{draft.phone}</div>
        <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-paper px-3 py-3 text-sm">
          {body}
        </p>
        <button
          type="button"
          onClick={() => openDeviceSms(draft)}
          className="mt-4 w-full rounded-xl bg-ink py-3 text-sm font-medium text-white"
        >
          Открыть SMS
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full py-2 text-sm text-muted"
        >
          Позже
        </button>
      </div>
    </div>
  )
}
