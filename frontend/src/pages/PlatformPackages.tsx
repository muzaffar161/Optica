import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import { formatSum } from '../types'

type Pack = {
  id: string
  name: string
  smsCount: number
  price: number
  currency: string
  isActive: boolean
}

export default function PlatformPackages() {
  const toast = useToast()
  const [items, setItems] = useState<Pack[]>([])
  const [open, setOpen] = useState<Pack | 'new' | null>(null)
  const [name, setName] = useState('')
  const [smsCount, setSmsCount] = useState(100)
  const [price, setPrice] = useState(0)
  const [pending, setPending] = useState(false)

  async function load() {
    setItems(await api<Pack[]>('/platform/sms-packages'))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  function start(pack?: Pack) {
    if (pack) {
      setOpen(pack)
      setName(pack.name)
      setSmsCount(pack.smsCount)
      setPrice(pack.price)
    } else {
      setOpen('new')
      setName('')
      setSmsCount(100)
      setPrice(25000)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const body = JSON.stringify({ name, smsCount, price })
      if (open === 'new') await api('/platform/sms-packages', { method: 'POST', body })
      else if (open && open !== 'new') {
        await api(`/platform/sms-packages/${open.id}`, { method: 'PATCH', body })
      }
      toast('Сохранено')
      setOpen(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function toggle(pack: Pack) {
    await api(`/platform/sms-packages/${pack.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !pack.isActive }),
    })
    await load()
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">SMS-пакеты</h1>
          <p className="mt-1 text-sm text-muted">Количество и цена правятся здесь, без правки кода.</p>
        </div>
        <button type="button" onClick={() => start()} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">
          Создать пакет
        </button>
      </div>
      <div className="space-y-3">
        {items.map((pack) => (
          <article key={pack.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{pack.name}</div>
                <div className="text-sm text-muted">
                  {pack.smsCount} SMS · {formatSum(pack.price)}
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs ${pack.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                {pack.isActive ? 'активен' : 'выкл'}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <button type="button" onClick={() => start(pack)} className="text-ink hover:underline">
                Изменить
              </button>
              <button type="button" onClick={() => toggle(pack)} className="text-muted hover:underline">
                {pack.isActive ? 'Выключить' : 'Включить'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <Modal title={open === 'new' ? 'Новый пакет' : 'Пакет'} onClose={() => setOpen(null)}>
          <form onSubmit={save} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-line px-3 py-2.5 outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Количество SMS</span>
              <input required type="number" min={1} value={smsCount} onChange={(e) => setSmsCount(Number(e.target.value))} className="w-full rounded-xl border border-line px-3 py-2.5 outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Цена, сум</span>
              <input required type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full rounded-xl border border-line px-3 py-2.5 outline-none" />
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
