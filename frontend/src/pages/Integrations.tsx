import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import { formatDate } from '../types'

type KeyRow = {
  id: string
  name: string
  prefix: string
  active: boolean
  lastUsedAt: string | null
  createdAt: string
}

export default function IntegrationsPage() {
  const toast = useToast()
  const [items, setItems] = useState<KeyRow[]>([])
  const [name, setName] = useState('Ключ API')
  const [created, setCreated] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    setItems(await api<KeyRow[]>('/integrations/keys'))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const row = await api<{ key: string }>('/integrations/keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setCreated(row.key)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function revoke(id: string) {
    await api(`/integrations/keys/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div>
        <h1 className="font-display text-3xl">API</h1>
        <p className="mt-1 text-sm text-muted">
          Ключ передаётся заголовком X-Api-Key. Доступны GET /api/v1/orders, /clients, /salons.
        </p>
      </div>
      {created && (
        <div className="rounded-2xl border border-line bg-card p-4 text-sm">
          <div className="text-muted">Скопируйте ключ — больше он не покажется</div>
          <code className="mt-2 block break-all">{created}</code>
        </div>
      )}
      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5"
        />
        <button type="submit" disabled={pending} className="rounded-xl bg-ink px-4 py-2.5 text-sm text-white disabled:opacity-60">
          Создать
        </button>
      </form>
      <div className="space-y-2">
        {items.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
            <div>
              <div>{row.name}</div>
              <div className="text-xs text-muted">
                {row.prefix}… · {row.active ? 'активен' : 'отозван'}
                {row.lastUsedAt ? ` · был ${formatDate(row.lastUsedAt)}` : ''}
              </div>
            </div>
            {row.active && (
              <button type="button" onClick={() => revoke(row.id)} className="text-red-700 hover:underline">
                Отозвать
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
