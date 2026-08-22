import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import ClientPicker from './ClientPicker'
import { isPhoneValid, UZ_DEFAULT } from '../phone'
import { draftLabel, ensureCurrent, holdCurrent, parseAmount, formatAmountInput, setCurrent } from '../orderDraft'
import { personName } from '../name'
import type { Category, Client, Page, Product } from '../types'
import { track } from '../usage'

type Cart = Record<string, number>

export default function NewOrderSheet() {
  const toast = useToast()
  const navigate = useNavigate()
  const initial = ensureCurrent(UZ_DEFAULT, 'catalog')
  const [draftId] = useState(initial.id)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [opened, setOpened] = useState<string | null>(initial.opened)
  const [productQ, setProductQ] = useState('')
  const [cart, setCart] = useState<Cart>(initial.cart)
  const [note, setNote] = useState(initial.note)
  const [amount, setAmount] = useState(initial.amount)
  const [step, setStep] = useState<'goods' | 'client'>(initial.step)
  const [creatingClient, setCreatingClient] = useState(initial.creatingClient)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState(initial.clientId)
  const [fullName, setFullName] = useState(initial.fullName)
  const [phone, setPhone] = useState(initial.phone || UZ_DEFAULT)
  const [pending, setPending] = useState(false)
  const skipPersist = useRef(false)
  const openedAt = useRef(Date.now())
  const stepAt = useRef(Date.now())

  function leaveStep(stepName: 'goods' | 'client') {
    track('order_step', {
      ms: Date.now() - stepAt.current,
      meta: { kind: 'catalog', step: stepName },
    })
    stepAt.current = Date.now()
  }

  function goClient() {
    if (step === 'goods') leaveStep('goods')
    setStep('client')
  }

  function goGoods() {
    if (step === 'client') leaveStep('client')
    setStep('goods')
  }

  const visible = useMemo(() => {
    const term = productQ.trim().toLowerCase()
    return products.filter((p) => {
      if (!term && opened === 'none' && p.categoryId) return false
      if (!term && opened && opened !== 'none' && p.categoryId !== opened) return false
      if (term && !p.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [products, productQ, opened])

  const selected = useMemo(
    () =>
      products
        .filter((p) => cart[p.id])
        .map((p) => ({ product: p, qty: cart[p.id] })),
    [products, cart],
  )
  const count = selected.reduce((sum, row) => sum + row.qty, 0)

  async function loadProducts() {
    const data = await api<Page<Product>>('/products?page=1&pageSize=100')
    setProducts(data.items)
  }

  async function loadCategories() {
    setCategories(await api<Category[]>('/categories'))
  }

  async function loadClients(query = '') {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    params.set('page', '1')
    params.set('pageSize', '30')
    const data = await api<Page<Client>>(`/clients?${params}`)
    setClients(data.items)
  }

  useEffect(() => {
    track('order_open', {
      meta: { kind: 'catalog', note: initial.step === 'client' ? 'resume' : 'new' },
    })
    loadProducts().catch((err: Error) => toast(err.message, 'err'))
    loadCategories().catch((err: Error) => toast(err.message, 'err'))
    loadClients().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  function persistDraft() {
    const names = Object.fromEntries(products.map((p) => [p.id, p.name]))
    setCurrent({
      id: draftId,
      updatedAt: new Date().toISOString(),
      label: draftLabel(cart, note, names),
      kind: 'catalog',
      cart,
      note,
      opened,
      step,
      creatingClient,
      clientId,
      fullName,
      phone,
      lens: '',
      frame: '',
      amount,
      paid: '',
      blocks: [],
    })
  }

  useEffect(() => {
    if (skipPersist.current) return
    persistDraft()
  }, [draftId, cart, note, amount, opened, step, creatingClient, clientId, fullName, phone, products])

  function bump(id: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev }
      const qty = (next[id] ?? 0) + delta
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(99, qty)
      return next
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (count === 0 && !note.trim()) {
      track('error', { meta: { kind: 'catalog', reason: 'empty' } })
      toast('Ткните товары или напишите, что заказать', 'err')
      return
    }
    if (creatingClient) {
      if (personName(fullName).length < 2) {
        track('error', { meta: { kind: 'catalog', reason: 'name' } })
        toast('Укажите ФИО', 'err')
        return
      }
      if (!isPhoneValid(phone)) {
        track('error', { meta: { kind: 'catalog', reason: 'phone' } })
        toast('Проверьте номер телефона', 'err')
        return
      }
    } else if (!clientId) {
      track('error', { meta: { kind: 'catalog', reason: 'client' } })
      toast('Выберите клиента или добавьте нового', 'err')
      return
    }
    const parsed = parseAmount(amount)
    if (parsed == null || parsed < 1) {
      track('error', { meta: { kind: 'catalog', reason: 'amount' } })
      toast('Укажите сумму заказа', 'err')
      return
    }
    setPending(true)
    try {
      const items = Object.entries(cart).map(([productId, qty]) => ({
        productId,
        qty,
      }))
      const body = creatingClient
        ? { kind: 'catalog', items, note: note.trim() || undefined, amount: parsed, client: { fullName: personName(fullName), phone } }
        : { kind: 'catalog', items, note: note.trim() || undefined, amount: parsed, clientId }
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (step === 'client') leaveStep('client')
      else leaveStep('goods')
      track('order_submit', {
        ms: Date.now() - openedAt.current,
        meta: {
          kind: 'catalog',
          newClient: creatingClient,
          items: count,
          note: !!note.trim(),
        },
      })
      toast('Заказ создан')
      skipPersist.current = true
      setCurrent(null)
      navigate('/')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  const goods = (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        value={productQ}
        onChange={(e) => setProductQ(e.target.value)}
        placeholder="Найти товар"
        className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 outline-none"
      />
      {opened === null && !productQ.trim() ? (
        products.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted">
            <p>Сначала добавьте товары в каталог.</p>
            <Link to="/products" className="text-brass-dark underline">
              Открыть товары
            </Link>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pb-2 sm:grid-cols-3">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpened(c.id)}
                className="flex aspect-4/3 flex-col items-start justify-between rounded-2xl border border-line bg-card p-4 text-left hover:border-brass"
              >
                <span className="font-display text-lg leading-tight">{c.name}</span>
                <span className="text-xs text-muted">
                  {products.filter((p) => p.categoryId === c.id).length} тов.
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpened('none')}
              className="flex aspect-4/3 flex-col items-start justify-between rounded-2xl border border-line bg-card p-4 text-left hover:border-brass"
            >
              <span className="font-display text-lg leading-tight">Без категории</span>
              <span className="text-xs text-muted">
                {products.filter((p) => !p.categoryId).length} тов.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOpened('')}
              className="flex aspect-4/3 flex-col items-start justify-between rounded-2xl border border-line bg-card p-4 text-left hover:border-brass"
            >
              <span className="font-display text-lg leading-tight">Все товары</span>
              <span className="text-xs text-muted">{products.length} тов.</span>
            </button>
          </div>
        )
      ) : (
        <>
      {(opened !== null || productQ.trim()) && (
        <button
          type="button"
          onClick={() => {
            setOpened(null)
            setProductQ('')
          }}
          className="mb-3 hidden self-start text-sm text-muted hover:text-ink md:inline"
        >
          ← Категории
        </button>
      )}
      {products.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted">
          <p>Сначала добавьте товары в каталог.</p>
          <Link to="/products" className="text-brass-dark underline">
            Открыть товары
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Нет такого товара.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pb-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => {
            const qty = cart[product.id] ?? 0
            return (
              <article
                key={product.id}
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  qty
                    ? 'border-ink bg-ink text-white shadow-sm'
                    : 'border-line bg-card'
                }`}
              >
                <button
                  type="button"
                  onClick={() => bump(product.id, 1)}
                  className="block w-full text-left"
                >
                  <div className={`aspect-square ${qty ? 'bg-ink-soft' : 'bg-paper'}`}>
                    {product.photoPath ? (
                      <img
                        src={product.photoPath}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-full items-center justify-center px-2 text-center text-xs ${
                          qty ? 'text-white/70' : 'text-muted'
                        }`}
                      >
                        {product.name}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 pb-0">
                    {product.category && (
                      <div className={`mb-0.5 text-[10px] uppercase tracking-wide ${qty ? 'text-brass' : 'text-brass-dark'}`}>
                        {product.category.name}
                      </div>
                    )}
                    <span className="text-sm font-medium leading-snug">{product.name}</span>
                  </div>
                </button>
                {qty > 0 ? (
                  <div className="flex items-center gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => bump(product.id, -1)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-xl font-bold text-white hover:bg-red-700"
                      aria-label="Убавить"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => bump(product.id, 1)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl font-bold text-white hover:bg-white/25"
                      aria-label="Добавить"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 pt-2 text-xs text-muted">Нажмите, чтобы добавить</div>
                )}
              </article>
            )
          })}
        </div>
      )}
        </>
      )}
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map(({ product, qty }) => (
            <div
              key={product.id}
              className="flex items-center overflow-hidden rounded-full border border-line bg-paper text-sm"
            >
              <button
                type="button"
                onClick={() => bump(product.id, -1)}
                className="flex h-9 w-9 items-center justify-center bg-red-600 text-lg font-bold text-white hover:bg-red-700"
                aria-label="Убавить"
              >
                −
              </button>
              <span className="px-3">
                {product.name} · {qty}
              </span>
              <button
                type="button"
                onClick={() => bump(product.id, 1)}
                className="flex h-9 w-9 items-center justify-center bg-ink text-lg font-bold text-white hover:bg-ink-soft"
                aria-label="Добавить"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const clientBlock = (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="rounded-xl bg-paper px-3 py-2 text-sm">
          {selected
            .map(({ product, qty }) =>
              qty > 1 ? `${product.name} ×${qty}` : product.name,
            )
            .join(', ')}
        </div>
      )}
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-sm text-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
            <rect x="2" y="3" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Другой товар
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Если нет в каталоге"
          className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
        />
      </label>
      <ClientPicker
        clients={clients}
        clientId={clientId}
        fullName={fullName}
        phone={phone}
        creating={creatingClient}
        onSearch={(query) => {
          loadClients(query).catch(() => {})
        }}
        onSelect={(client) => {
          setCreatingClient(false)
          setClientId(client.id)
          setFullName(personName(client.fullName))
          setPhone(client.phone)
        }}
        onStartCreate={(draft) => {
          setCreatingClient(true)
          setClientId('')
          setFullName(draft.fullName)
          setPhone(draft.phone)
        }}
        onChangeName={setFullName}
        onChangePhone={setPhone}
        onClear={() => {
          setCreatingClient(false)
          setClientId('')
          setFullName('')
          setPhone(UZ_DEFAULT)
          loadClients().catch(() => {})
        }}
      />
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Итог</span>
        <input
          value={formatAmountInput(amount)}
          onChange={(e) => setAmount(formatAmountInput(e.target.value))}
          inputMode="numeric"
          enterKeyHint="done"
          placeholder="сумма"
          className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
        />
      </label>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5">
          <h2 className="min-w-0 flex-1 font-display text-xl">Новый заказ</h2>
          <button
            type="button"
            onClick={() => {
              skipPersist.current = true
              persistDraft()
              if (!holdCurrent()) {
                skipPersist.current = false
                track('error', { meta: { kind: 'catalog', reason: 'empty' } })
                toast('Сначала добавьте товар', 'err')
                return
              }
              track('order_hold', {
                ms: Date.now() - openedAt.current,
                meta: { kind: 'catalog' },
              })
              toast('Заказ отложен — он на экране заказов')
              navigate('/')
            }}
            className="rounded-xl border border-line px-3 py-2 text-sm"
          >
            Отложить
          </button>
          <button
            type="button"
            onClick={() => {
              skipPersist.current = true
              persistDraft()
              holdCurrent()
              track('order_close', {
                ms: Date.now() - openedAt.current,
                meta: { kind: 'catalog' },
              })
              navigate('/')
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-muted hover:bg-paper hover:text-ink"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row md:p-5">
            <div className={`min-h-0 flex-1 flex-col md:flex ${step === 'goods' ? 'flex' : 'hidden md:flex'}`}>
              {goods}
            </div>
            <div
              className={`w-full shrink-0 overflow-y-auto md:w-80 md:border-l md:border-line md:pl-5 ${
                step === 'client' ? 'block' : 'hidden md:block'
              }`}
            >
              {clientBlock}
            </div>
          </div>

          <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5 md:pb-4">
            <div className="flex gap-2 md:hidden">
              {step === 'goods' ? (
                opened !== null || productQ.trim() ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpened(null)
                        setProductQ('')
                      }}
                      className="w-1/3 rounded-xl border border-line py-3.5 text-sm"
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      onClick={() => goClient()}
                      className="w-2/3 rounded-xl bg-ink py-3.5 text-sm font-medium text-white"
                    >
                      Далее{count ? ` · ${count}` : ''}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => goClient()}
                    className="w-full rounded-xl bg-ink py-3.5 text-sm font-medium text-white"
                  >
                    Далее{count ? ` · ${count}` : ''}
                  </button>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => goGoods()}
                    className="w-1/3 rounded-xl border border-line py-3.5 text-sm"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-2/3 rounded-xl bg-ink py-3.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {pending ? 'Сохраняем…' : 'Создать заказ'}
                  </button>
                </>
              )}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="hidden w-full rounded-xl bg-ink py-3 text-sm font-medium text-white disabled:opacity-60 md:block"
            >
              {pending ? 'Сохраняем…' : count ? `Создать заказ · ${count}` : 'Создать заказ'}
            </button>
          </div>
        </form>
    </div>
  )
}
