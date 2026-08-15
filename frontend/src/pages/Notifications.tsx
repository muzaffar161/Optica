import { useEffect, useState } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Pagination from '../components/Pagination'
import ArchiveTabs, { ArchiveAction } from '../components/ArchiveTabs'
import { formatDate, type NotificationLog, type Page } from '../types'
import { useAuth } from '../AuthContext'
import { canEdit } from '../access'

const PAGE_SIZE = 50

function channelLabel(n: NotificationLog) {
  if (n.channel === 'telegram') return 'Telegram'
  return n.status === 'mocked' ? 'SMS (заглушка)' : 'SMS'
}

function Status({ n }: { n: NotificationLog }) {
  if (n.status === 'sent') return <span className="text-emerald-700">доставлено</span>
  if (n.status === 'mocked') return <span className="text-amber-700">заглушка</span>
  return (
    <span className="text-red-700" title={n.error ?? ''}>
      ошибка
    </span>
  )
}

export default function Notifications() {
  const toast = useToast()
  const { user } = useAuth()
  const writable = canEdit(user, 'journal')
  const [items, setItems] = useState<NotificationLog[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [archive, setArchive] = useState(false)
  const [archiveAfterDays, setArchiveAfterDays] = useState(10)

  async function load(nextPage = 1) {
    const query = new URLSearchParams()
    query.set('page', String(nextPage))
    query.set('pageSize', String(PAGE_SIZE))
    if (archive) query.set('archive', '1')
    const data = await api<Page<NotificationLog> & { archiveAfterDays?: number }>(
      `/notifications?${query}`,
    )
    setItems(data.items)
    setTotal(data.total)
    setPage(data.page)
    if (data.archiveAfterDays) setArchiveAfterDays(data.archiveAfterDays)
  }

  useEffect(() => {
    load(1).catch((err: Error) => toast(err.message, 'err'))
  }, [archive])

  async function toggleArchive(n: NotificationLog) {
    try {
      await api(`/notifications/${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !n.archived }),
      })
      toast(n.archived ? 'Вернули из архива' : 'В архиве')
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">Журнал</h1>
        <ArchiveTabs archive={archive} onChange={setArchive} />
      </div>
      <p className="mt-[-1rem] mb-6 text-sm text-muted">
        {archive
          ? `Вручную и старше ${archiveAfterDays} дн.`
          : 'Каждая попытка отправки: Telegram, ошибка бота и fallback на SMS.'}
      </p>

      <div className="space-y-3 md:hidden">
        {items.length === 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-16 text-center text-muted">
            {archive ? 'В архиве пока пусто.' : 'Пока ничего не отправляли.'}
          </div>
        )}
        {items.map((n) => (
          <article key={n.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{n.order?.client.fullName}</div>
                <div className="text-xs text-muted">{n.order?.client.phone}</div>
              </div>
              <div className="shrink-0 text-xs text-muted">{formatDate(n.createdAt)}</div>
            </div>
            <div className="mt-2 text-sm">{n.order?.title}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              <span>{channelLabel(n)}</span>
              <Status n={n} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed break-words text-muted">
              {n.message}
            </p>
            {n.error && <p className="mt-1 text-xs text-red-700">{n.error}</p>}
            {writable && (
              <div className="mt-3">
                <ArchiveAction archived={n.archived} onToggle={() => toggleArchive(n)} />
              </div>
            )}
          </article>
        ))}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Время</th>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Заказ</th>
              <th className="px-4 py-3 font-medium">Канал</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Текст</th>
              {writable && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={writable ? 7 : 6} className="px-4 py-16 text-center text-muted">
                  {archive ? 'В архиве пока пусто.' : 'Пока ничего не отправляли.'}
                </td>
              </tr>
            )}
            {items.map((n) => (
              <tr key={n.id} className="border-b border-line last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatDate(n.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {n.order?.client.fullName}
                  <div className="text-xs text-muted">{n.order?.client.phone}</div>
                </td>
                <td className="px-4 py-3">{n.order?.title}</td>
                <td className="px-4 py-3">{channelLabel(n)}</td>
                <td className="px-4 py-3">
                  <Status n={n} />
                </td>
                <td className="max-w-sm px-4 py-3 whitespace-pre-wrap text-xs text-muted">
                  {n.message}
                  {n.error && <div className="mt-1 text-red-700">{n.error}</div>}
                </td>
                {writable && (
                  <td className="px-4 py-3 text-right">
                    <ArchiveAction archived={n.archived} onToggle={() => toggleArchive(n)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>
    </div>
  )
}
