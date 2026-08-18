import { useEffect, useState, type FormEvent } from 'react'
import { api, downloadCsv } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import SearchBox from '../components/SearchBox'
import Highlight from '../components/Highlight'
import PhoneInput from '../components/PhoneInput'
import ArchiveTabs, { ArchiveAction } from '../components/ArchiveTabs'
import { isPhoneValid, UZ_DEFAULT } from '../phone'
import { formatDate, featuresOf, type Client, type Page } from '../types'
import { formatPersonName, personName } from '../name'
import { useAuth } from '../AuthContext'
import { canAll, canEdit } from '../access'

const PAGE_SIZE = 50

export default function Clients() {
  const toast = useToast()
  const { user } = useAuth()
  const writable = canEdit(user, 'clients')
  const removable = canAll(user, 'clients')
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [archive, setArchive] = useState(false)
  const [archiveAfterDays, setArchiveAfterDays] = useState(10)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)

  async function load(query = q, nextPage = page) {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (archive) params.set('archive', '1')
    params.set('page', String(nextPage))
    params.set('pageSize', String(PAGE_SIZE))
    const data = await api<Page<Client> & { archiveAfterDays?: number }>(
      `/clients?${params}`,
    )
    setClients(data.items)
    setTotal(data.total)
    setPage(data.page)
    if (data.archiveAfterDays) setArchiveAfterDays(data.archiveAfterDays)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(q, 1).catch((err: Error) => toast(err.message, 'err'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [q, archive])

  function openCreate() {
    setEditing(null)
    setFullName('')
    setPhone(UZ_DEFAULT)
    setOpen(true)
  }

  function openEdit(client: Client) {
    setEditing(client)
    setFullName(formatPersonName(client.fullName))
    setPhone(client.phone)
    setOpen(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!isPhoneValid(phone)) {
      toast('Проверьте номер телефона', 'err')
      return
    }
    setPending(true)
    try {
      if (editing) {
        await api<Client>(`/clients/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ fullName: personName(fullName), phone }),
        })
        toast('Клиент обновлён')
      } else {
        await api<Client>('/clients', {
          method: 'POST',
          body: JSON.stringify({ fullName: personName(fullName), phone }),
        })
        toast('Клиент добавлен')
      }
      setOpen(false)
      await load(q, editing ? page : 1)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function remove(client: Client) {
    if (!window.confirm(`Удалить клиента ${client.fullName}? Заказы тоже удалятся.`)) return
    try {
      await api(`/clients/${client.id}`, { method: 'DELETE' })
      toast('Клиент удалён')
      await load(q, page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function toggleArchive(client: Client) {
    try {
      await api(`/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !client.archived }),
      })
      toast(client.archived ? 'Вернули из архива' : 'В архиве')
      await load(q, page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl">Клиенты</h1>
            <ArchiveTabs archive={archive} onChange={setArchive} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {archive
              ? `Вручную и старше ${archiveAfterDays} дн.`
              : 'Telegram подключается, когда клиент напишет боту этот номер.'}
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {featuresOf(user).canExport && (
            <button
              type="button"
              onClick={() =>
                downloadCsv('/export/clients', 'clients.csv').catch((err: Error) => toast(err.message, 'err'))
              }
              className="rounded-xl border border-line px-4 py-2.5 text-sm"
            >
              Экспорт
            </button>
          )}
          {writable && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-soft"
            >
              Новый клиент
            </button>
          )}
        </div>
      </div>

      <SearchBox
        value={q}
        onChange={setQ}
        onSubmit={() => load(q, 1).catch((err: Error) => toast(err.message, 'err'))}
        placeholder="Имя или телефон"
        className="mb-4 max-w-none"
      />

      <div className="space-y-3 md:hidden">
        {clients.length === 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-16 text-center text-muted">
            Клиентов нет.
          </div>
        )}
        {clients.map((client) => (
          <article key={client.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="font-medium">
              <Highlight text={client.fullName} query={q} />
            </div>
            <div className="mt-0.5 text-sm text-muted">
              <Highlight text={client.phone} query={q} phone />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              {client.telegramChatId ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">
                  Telegram
                </span>
              ) : (
                <span>только SMS</span>
              )}
              <span>{client._count?.orders ?? 0} зак.</span>
              <span>{formatDate(client.createdAt)}</span>
              {client.archived && (
                <span className="uppercase tracking-wide text-brass-dark">архив</span>
              )}
            </div>
            {(writable || removable) && (
              <div className="mt-3 flex gap-4">
                {writable && (
                  <button
                    type="button"
                    onClick={() => openEdit(client)}
                    className="text-sm text-ink hover:underline"
                  >
                    Изменить
                  </button>
                )}
                {writable && (
                  <ArchiveAction
                    archived={client.archived}
                    onToggle={() => toggleArchive(client)}
                  />
                )}
                {removable && (
                  <button
                    type="button"
                    onClick={() => remove(client)}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Удалить
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(next) => load(q, next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Telegram</th>
              <th className="px-4 py-3 font-medium">Заказы</th>
              <th className="px-4 py-3 font-medium">Добавлен</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-muted">
                  Клиентов нет.
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Highlight text={client.fullName} query={q} />
                </td>
                <td className="px-4 py-3">
                  <Highlight text={client.phone} query={q} phone />
                </td>
                <td className="px-4 py-3">
                  {client.telegramChatId ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                      подключён
                    </span>
                  ) : (
                    <span className="text-xs text-muted">нет</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{client._count?.orders ?? 0}</td>
                <td className="px-4 py-3 text-muted">{formatDate(client.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {writable && (
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      className="mr-2 text-xs text-ink hover:underline"
                    >
                      Изменить
                    </button>
                  )}
                  {writable && (
                    <ArchiveAction
                      archived={client.archived}
                      onToggle={() => toggleArchive(client)}
                    />
                  )}
                  {removable && (
                    <button
                      type="button"
                      onClick={() => remove(client)}
                      className="ml-2 text-xs text-red-700 hover:underline"
                    >
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={(next) => load(q, next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>

      {writable && (
        <button
          type="button"
          onClick={openCreate}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-2xl bg-ink py-3.5 text-sm font-medium text-white shadow-lg md:hidden"
        >
          Новый клиент
        </button>
      )}

      {open && (
        <Modal title={editing ? 'Клиент' : 'Новый клиент'} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">ФИО</span>
              <input
                required
                minLength={2}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={fullName}
                onChange={(e) => setFullName(formatPersonName(e.target.value))}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <PhoneInput required value={phone} onChange={setPhone} />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
