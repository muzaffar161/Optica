import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import Select from './Select'
import ClientPicker from './ClientPicker'
import { isPhoneValid, UZ_DEFAULT } from '../phone'
import { personName } from '../name'
import { mergeRecent, readRecent, rememberRecent } from '../recentRx'
import {
  emptyBlock,
  ensureCurrent,
  holdCurrent,
  nextBlockLabel,
  parseAmount,
  formatAmountInput,
  rxDraftLabel,
  setCurrent,
  type RxBlock,
  type RxEye,
} from '../orderDraft'
import { formatSum, type Client, type Page } from '../types'

const LABELS = ['Очки для дали', 'Очки для чтения', 'Компьютерные', 'Другое']

function focusAdjacent(from: HTMLInputElement, dir: 1 | -1 = 1) {
  const form = from.form
  if (!form) return
  const fields = [...form.querySelectorAll<HTMLInputElement>('input')].filter(
    (el) =>
      el.type !== 'hidden' &&
      el.type !== 'checkbox' &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null,
  )
  const i = fields.indexOf(from)
  const next = fields[i + dir]
  if (!next) return
  next.focus()
  const len = next.value.length
  if (dir < 0) next.setSelectionRange(len, len)
  else next.select()
}

function rxComplete(kind: string, value: string) {
  const v = value.trim().replace(/\s/g, '')
  if (!v) return false
  if (kind === 'ax') {
    if (/^\d{3}$/.test(v)) return true
    const n = Number(v)
    return /^\d{2}$/.test(v) && n > 18 && n <= 180
  }
  if (kind === 'dpp') return /^\d{2}$/.test(v)
  return /^[+-]?\d{1,2}[.,]\d{2}$/.test(v)
}

function limitDiopter(raw: string) {
  const s = raw.replace(/[^\d.,]/g, '').replace('.', ',')
  const comma = s.indexOf(',')
  if (comma >= 0) {
    const intPart = s.slice(0, comma).replace(/\D/g, '').slice(0, 2)
    const dec = s.slice(comma + 1).replace(/\D/g, '').slice(0, 2)
    return `${intPart},${dec}`
  }
  const digits = s.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)},${digits.slice(2, 4)}`
}

function limitAx(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 3)
}

function limitDpp(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 2)
}

function parseSigned(value: string, fallback: '+' | '-' = '+'): { sign: '+' | '-'; body: string } {
  if (value.startsWith('+')) return { sign: '+', body: value.slice(1) }
  if (value.startsWith('-')) return { sign: '-', body: value.slice(1) }
  return { sign: fallback, body: value }
}

function joinSigned(sign: '+' | '-', body: string) {
  const raw = body.replace(/^[+-]+/, '')
  if (!raw) return sign
  return sign + raw
}

function withSign(value: string, fallback: '+' | '-') {
  if (!hasRxNumber(value)) return ''
  if (value.startsWith('+') || value.startsWith('-')) return value
  return fallback + value.replace(/^[+-]+/, '')
}

function hasRxNumber(value: string) {
  return value.replace(/^[+-]+/, '').trim() !== ''
}

function RecentChips({
  items,
  current,
  onPick,
}: {
  items: string[]
  current: string
  onPick: (value: string) => void
}) {
  const visible = items.filter(
    (item) => item.trim().toLocaleLowerCase('ru-RU') !== current.trim().toLocaleLowerCase('ru-RU'),
  )
  if (!visible.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visible.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          className="max-w-full truncate rounded-full border border-line px-3 py-1 text-xs hover:border-brass hover:bg-paper"
        >
          {item}
        </button>
      ))}
    </div>
  )
}

function EyeRow({
  side,
  value,
  onChange,
}: {
  side: 'OD' | 'OS'
  value: RxEye
  onChange: (next: RxEye) => void
}) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
      <span className="text-xs font-medium">{side}</span>
      <Field
        label="Sph"
        rx="sph"
        signed
        defaultSign="-"
        value={value.sph}
        onChange={(sph) => onChange({ ...value, sph })}
      />
      <Field
        label="Cyl"
        rx="cyl"
        signed
        defaultSign="-"
        value={value.cyl}
        onChange={(cyl) => onChange({ ...value, cyl })}
      />
      <Field
        label="ax"
        rx="ax"
        value={value.ax}
        onChange={(ax) => onChange({ ...value, ax })}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  rx,
  signed,
  defaultSign = '-',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rx: 'sph' | 'cyl' | 'ax'
  signed?: boolean
  defaultSign?: '+' | '-'
}) {
  const { sign, body } = parseSigned(value, defaultSign)
  const nextSign = sign === '-' ? '+' : '-'

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="flex min-w-0 overflow-hidden rounded-xl border border-line bg-card">
        {signed && (
          <button
            type="button"
            onClick={() => onChange(joinSigned(nextSign, body))}
            className="w-7 shrink-0 text-base font-medium text-ink"
            aria-label={sign === '+' ? 'Сейчас плюс, поставить минус' : 'Сейчас минус, поставить плюс'}
          >
            {sign === '-' ? '−' : '+'}
          </button>
        )}
        <input
          value={signed ? body : value}
          data-rx={rx}
          inputMode={rx === 'ax' ? 'numeric' : 'decimal'}
          enterKeyHint="next"
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => {
            const raw = e.target.value
            if (signed && !/\d/.test(body) && /^[.,]$/.test(raw.trim())) {
              onChange(joinSigned(nextSign, ''))
              return
            }
            const limited =
              rx === 'ax' ? limitAx(raw) : signed ? limitDiopter(raw) : raw
            const next = signed ? joinSigned(sign, limited) : limited
            onChange(next)
            if (rxComplete(rx, next)) {
              const el = e.currentTarget
              requestAnimationFrame(() => focusAdjacent(el))
            }
          }}
          className="min-w-0 w-full flex-1 bg-transparent px-1.5 py-2 outline-none"
        />
      </span>
    </label>
  )
}

export default function NewRxOrderSheet() {
  const toast = useToast()
  const navigate = useNavigate()
  const initial = ensureCurrent(UZ_DEFAULT, 'rx')
  const [draftId] = useState(initial.id)
  const [blocks, setBlocks] = useState<RxBlock[]>(
    initial.blocks.length ? initial.blocks : [emptyBlock()],
  )
  const [lens, setLens] = useState(initial.lens)
  const [frame, setFrame] = useState(initial.frame)
  const [lensRecent, setLensRecent] = useState(() => readRecent('lens'))
  const [frameRecent, setFrameRecent] = useState(() => readRecent('frame'))
  const [amount, setAmount] = useState(initial.amount)
  const [paid, setPaid] = useState(initial.paid)
  const [showDeposit, setShowDeposit] = useState(!!initial.paid.trim())
  const [creatingClient, setCreatingClient] = useState(initial.creatingClient)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState(initial.clientId)
  const [fullName, setFullName] = useState(initial.fullName)
  const [phone, setPhone] = useState(initial.phone || UZ_DEFAULT)
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState<'goods' | 'client'>(
    initial.step === 'client' ? 'client' : 'goods',
  )
  const skipPersist = useRef(false)

  async function loadClients(query = '') {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    params.set('page', '1')
    params.set('pageSize', '30')
    const data = await api<Page<Client>>(`/clients?${params}`)
    setClients(data.items)
  }

  useEffect(() => {
    loadClients().catch((err: Error) => toast(err.message, 'err'))
    api<{ lenses: string[]; frames: string[] }>('/orders/rx-suggestions')
      .then((data) => {
        setLensRecent(mergeRecent(readRecent('lens'), data.lenses))
        setFrameRecent(mergeRecent(readRecent('frame'), data.frames))
      })
      .catch(() => {})
  }, [])

  function persistDraft() {
    const draft = {
      id: draftId,
      updatedAt: new Date().toISOString(),
      kind: 'rx' as const,
      label: rxDraftLabel({ blocks, lens, frame, amount }),
      cart: {},
      note: '',
      opened: null as string | null,
      step,
      creatingClient,
      clientId,
      fullName,
      phone,
      lens,
      frame,
      amount,
      paid,
      blocks,
    }
    setCurrent(draft)
    return draft
  }

  useEffect(() => {
    if (skipPersist.current) return
    persistDraft()
  }, [draftId, blocks, lens, frame, amount, paid, creatingClient, clientId, fullName, phone, step])

  function patchBlock(id: string, next: Partial<RxBlock>) {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...next } : block)))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (step !== 'client') {
      setStep('client')
      return
    }
    const parsed = parseAmount(amount)
    const paidParsed = parseAmount(paid) ?? 0
    if (parsed != null && paidParsed > parsed) {
      toast('Залог не может быть больше итога', 'err')
      return
    }
    const filled = blocks.some(
      (block) =>
        block.dpp.trim() ||
        hasRxNumber(block.od.sph) ||
        hasRxNumber(block.od.cyl) ||
        block.od.ax.trim() ||
        hasRxNumber(block.os.sph) ||
        hasRxNumber(block.os.cyl) ||
        block.os.ax.trim(),
    )
    if (!filled && !lens.trim() && !frame.trim()) {
      toast('Заполните рецепт, линзу или оправу', 'err')
      return
    }
    if (creatingClient) {
      if (personName(fullName).length < 2) {
        toast('Укажите ФИО', 'err')
        return
      }
      if (!isPhoneValid(phone)) {
        toast('Проверьте номер телефона', 'err')
        return
      }
    } else if (!clientId) {
      toast('Выберите клиента или добавьте нового', 'err')
      return
    }
    setPending(true)
    try {
      const body = {
        kind: 'rx',
        amount: parsed,
        paidAmount: paidParsed || undefined,
        rx: {
          blocks: blocks.map((block) => ({
            label: block.label,
            od: {
              sph: withSign(block.od.sph, '-'),
              cyl: withSign(block.od.cyl, '-'),
              ax: block.od.ax,
            },
            os: {
              sph: withSign(block.os.sph, '-'),
              cyl: withSign(block.os.cyl, '-'),
              ax: block.os.ax,
            },
            dpp: block.dpp,
          })),
          lens: lens.trim() || undefined,
          frame: frame.trim() || undefined,
        },
        ...(creatingClient
          ? { client: { fullName: personName(fullName), phone } }
          : { clientId }),
      }
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (lens.trim()) rememberRecent('lens', lens.trim())
      if (frame.trim()) rememberRecent('frame', frame.trim())
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

  return (
    <div className="flex h-dvh flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5">
        <h2 className="min-w-0 flex-1 font-display text-xl">Заказ по рецепту</h2>
        <button
          type="button"
          onClick={() => {
            skipPersist.current = true
            persistDraft()
            if (!holdCurrent()) {
              skipPersist.current = false
              toast('Сначала заполните рецепт', 'err')
              return
            }
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
            navigate('/')
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-muted hover:bg-paper hover:text-ink"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          const t = e.target
          if (!(t instanceof HTMLInputElement)) return
          if ((e.key === 'Backspace' || e.key === 'Delete') && t.value === '') {
            e.preventDefault()
            focusAdjacent(t, -1)
            return
          }
          if (e.key !== 'Enter') return
          if (t.dataset.last === '1') return
          e.preventDefault()
          focusAdjacent(t)
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {step === 'goods' && (
              <>
            {blocks.map((block, index) => (
              <section
                key={block.id}
                className="rounded-2xl border border-line bg-paper/50 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Select
                    className="min-w-0 flex-1"
                    value={LABELS.includes(block.label) ? block.label : 'Другое'}
                    onChange={(value) => {
                      patchBlock(block.id, {
                        label: value === 'Другое' ? '' : value,
                      })
                    }}
                    options={LABELS.map((item) => ({ value: item, label: item }))}
                  />
                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBlocks((prev) => prev.filter((item) => item.id !== block.id))
                      }
                      className="rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Убрать
                    </button>
                  )}
                </div>
                {!LABELS.slice(0, 3).includes(block.label) && (
                  <input
                    value={block.label}
                    onChange={(e) => patchBlock(block.id, { label: e.target.value })}
                    placeholder="Название рецепта"
                    enterKeyHint="next"
                    className="mb-3 w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                  />
                )}
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Rp.
                </div>
                <div className="space-y-3">
                  <EyeRow
                    side="OD"
                    value={block.od}
                    onChange={(od) => patchBlock(block.id, { od })}
                  />
                  <EyeRow
                    side="OS"
                    value={block.os}
                    onChange={(os) => patchBlock(block.id, { os })}
                  />
                  <label className="flex max-w-48 items-end gap-2">
                    <span className="pb-2 text-sm text-muted">Dpp =</span>
                    <input
                      value={block.dpp}
                      data-rx="dpp"
                      onChange={(e) => {
                        const next = limitDpp(e.target.value)
                        patchBlock(block.id, { dpp: next })
                        if (rxComplete('dpp', next)) {
                          const el = e.currentTarget
                          requestAnimationFrame(() => focusAdjacent(el))
                        }
                      }}
                      inputMode="decimal"
                      enterKeyHint="next"
                      autoComplete="off"
                      className="w-full rounded-xl border border-line px-3 py-2 outline-none"
                    />
                    <span className="pb-2 text-sm text-muted">мм</span>
                  </label>
                </div>
                {index === blocks.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setBlocks((prev) => [
                        ...prev,
                        emptyBlock(nextBlockLabel(prev.length)),
                      ])
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-brass/50 px-3 py-2 text-sm text-brass-dark hover:bg-paper"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-lg leading-none text-white">
                      +
                    </span>
                    Ещё OD / OS
                  </button>
                )}
              </section>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="mb-1 block text-sm text-muted">Линза</span>
                  <input
                    value={lens}
                    onChange={(e) => setLens(e.target.value)}
                    enterKeyHint="next"
                    className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                  />
                </label>
                <RecentChips items={lensRecent} current={lens} onPick={setLens} />
              </div>
              <div>
                <label className="block">
                  <span className="mb-1 block text-sm text-muted">Оправа</span>
                  <input
                    value={frame}
                    onChange={(e) => setFrame(e.target.value)}
                    enterKeyHint="next"
                    className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                  />
                </label>
                <RecentChips items={frameRecent} current={frame} onPick={setFrame} />
              </div>
            </div>
              </>
            )}

            {step === 'client' && (
              <>
            <ClientPicker
              clients={clients}
              clientId={clientId}
              fullName={fullName}
              phone={phone}
              creating={creatingClient}
              autoFocus
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
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Итог</span>
                <input
                  value={formatAmountInput(amount)}
                  data-last={showDeposit ? undefined : '1'}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  inputMode="numeric"
                  enterKeyHint={showDeposit ? 'next' : 'done'}
                  placeholder="0"
                  className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (showDeposit) setPaid('')
                  setShowDeposit((open) => !open)
                }}
                className={`rounded-full px-3 py-1 text-sm ${
                  showDeposit ? 'bg-ink text-white' : 'border border-line'
                }`}
              >
                Есть залог
              </button>
              {showDeposit && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm text-muted">Залог</span>
                    <input
                      value={formatAmountInput(paid)}
                      data-last="1"
                      onChange={(e) => setPaid(formatAmountInput(e.target.value))}
                      inputMode="numeric"
                      enterKeyHint="done"
                      placeholder="0"
                      className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                    />
                  </label>
                  <div className="flex justify-between rounded-xl bg-paper px-3 py-2.5 text-sm">
                    <span className="text-muted">Осталось</span>
                    <span className="font-medium">
                      {parseAmount(amount) == null
                        ? '—'
                        : formatSum(
                            Math.max(
                              0,
                              (parseAmount(amount) ?? 0) - (parseAmount(paid) ?? 0),
                            ),
                          )}
                    </span>
                  </div>
                </>
              )}
            </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5 md:pb-4">
          {step === 'goods' ? (
            <button
              type="button"
              onClick={() => setStep('client')}
              className="w-full rounded-xl bg-ink py-3.5 text-sm font-medium text-white"
            >
              Далее
            </button>
          ) : (
            <div className="mx-auto w-full max-w-2xl">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('goods')}
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
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
