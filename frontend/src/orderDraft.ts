export type OrderKind = 'catalog' | 'rx'

export type RxEye = {
  sph: string
  cyl: string
  ax: string
}

export type RxBlock = {
  id: string
  label: string
  od: RxEye
  os: RxEye
  dpp: string
}

export type OrderDraft = {
  id: string
  updatedAt: string
  label: string
  kind: OrderKind
  cart: Record<string, number>
  note: string
  opened: string | null
  step: 'goods' | 'client'
  creatingClient: boolean
  clientId: string
  fullName: string
  phone: string
  lens: string
  frame: string
  amount: string
  paid: string
  blocks: RxBlock[]
}

const CURRENT_KEY = 'optika_draft_current'
const HELD_KEY = 'optika_draft_held'
const EVENT = 'optika-drafts'

const LABELS = ['Очки для дали', 'Очки для чтения', 'Компьютерные']

function emit() {
  window.dispatchEvent(new Event(EVENT))
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function emptyEye(): RxEye {
  return { sph: '', cyl: '', ax: '' }
}

export function emptyBlock(label = 'Очки для дали', id?: string): RxBlock {
  return {
    id: id || newId(),
    label,
    od: emptyEye(),
    os: emptyEye(),
    dpp: '',
  }
}

export function nextBlockLabel(count: number) {
  return LABELS[count] || `Рецепт ${count + 1}`
}

export function emptyDraft(phone = '+998', kind: OrderKind = 'catalog'): OrderDraft {
  return {
    id: newId(),
    updatedAt: new Date().toISOString(),
    label: kind === 'rx' ? 'Рецепт' : 'Пустой заказ',
    kind,
    cart: {},
    note: '',
    opened: null,
    step: 'goods',
    creatingClient: false,
    clientId: '',
    fullName: '',
    phone,
    lens: '',
    frame: '',
    amount: '',
    paid: '',
    blocks: kind === 'rx' ? [emptyBlock(LABELS[0])] : [],
  }
}

function normalize(draft: OrderDraft): OrderDraft {
  return {
    ...emptyDraft(draft.phone, draft.kind === 'rx' ? 'rx' : 'catalog'),
    ...draft,
    kind: draft.kind === 'rx' ? 'rx' : 'catalog',
    lens: draft.lens ?? '',
    frame: draft.frame ?? '',
    amount: draft.amount ?? '',
    paid: draft.paid ?? '',
    blocks:
      draft.kind === 'rx' && draft.blocks?.length
        ? draft.blocks
        : draft.kind === 'rx'
          ? [emptyBlock(LABELS[0])]
          : draft.blocks ?? [],
  }
}

export function getCurrent(): OrderDraft | null {
  const draft = read<OrderDraft | null>(CURRENT_KEY, null)
  return draft ? normalize(draft) : null
}

export function setCurrent(draft: OrderDraft | null) {
  if (draft) localStorage.setItem(CURRENT_KEY, JSON.stringify(draft))
  else localStorage.removeItem(CURRENT_KEY)
  emit()
}

function blockFilled(block: RxBlock) {
  return (
    block.dpp.trim() ||
    block.od.sph.trim() ||
    block.od.cyl.trim() ||
    block.od.ax.trim() ||
    block.os.sph.trim() ||
    block.os.cyl.trim() ||
    block.os.ax.trim()
  )
}

export function hasContent(draft: OrderDraft | null) {
  if (!draft) return false
  if (draft.kind === 'rx') {
    return (
      draft.blocks.some(blockFilled) ||
      !!draft.lens.trim() ||
      !!draft.frame.trim() ||
      !!draft.amount.trim() ||
      !!draft.note.trim()
    )
  }
  return Object.keys(draft.cart).length > 0 || !!draft.note.trim()
}

export function getHeld(): OrderDraft[] {
  return read<OrderDraft[]>(HELD_KEY, []).map(normalize)
}

export function startNew(phone = '+998', kind: OrderKind = 'catalog'): OrderDraft {
  const current = getCurrent()
  if (hasContent(current)) holdCurrent()
  const created = emptyDraft(phone, kind)
  setCurrent(created)
  return created
}

export function holdCurrent() {
  const current = getCurrent()
  if (!hasContent(current) || !current) return false
  const held = getHeld().filter((d) => d.id !== current.id)
  localStorage.setItem(
    HELD_KEY,
    JSON.stringify([{ ...current, updatedAt: new Date().toISOString() }, ...held]),
  )
  localStorage.removeItem(CURRENT_KEY)
  emit()
  return true
}

export function resumeDraft(id: string) {
  const current = getCurrent()
  if (hasContent(current)) holdCurrent()
  const found = getHeld().find((d) => d.id === id)
  if (!found) return false
  localStorage.setItem(
    HELD_KEY,
    JSON.stringify(getHeld().filter((d) => d.id !== id)),
  )
  setCurrent({ ...found, updatedAt: new Date().toISOString() })
  return true
}

export function removeHeld(id: string) {
  localStorage.setItem(
    HELD_KEY,
    JSON.stringify(getHeld().filter((d) => d.id !== id)),
  )
  emit()
}

export function ensureCurrent(phone = '+998', kind: OrderKind = 'catalog'): OrderDraft {
  const existing = getCurrent()
  if (existing && existing.kind === kind) return existing
  if (existing && hasContent(existing)) holdCurrent()
  const created = emptyDraft(phone, kind)
  setCurrent(created)
  return created
}

export function draftLabel(
  cart: Record<string, number>,
  note: string,
  names: Record<string, string>,
) {
  const parts = Object.entries(cart).map(([id, qty]) => {
    const name = names[id] || 'товар'
    return qty > 1 ? `${name} ×${qty}` : name
  })
  if (note.trim()) parts.push(note.trim())
  return parts.join(', ') || 'Пустой заказ'
}

export function rxDraftLabel(draft: Pick<OrderDraft, 'blocks' | 'lens' | 'frame' | 'amount'>) {
  const block = draft.blocks.find(blockFilled)
  const parts = [
    block ? `${block.label}${block.od.sph ? ` OD ${block.od.sph}` : ''}` : '',
    draft.lens.trim() ? `линза ${draft.lens.trim()}` : '',
    draft.frame.trim() ? `оправа ${draft.frame.trim()}` : '',
    draft.amount.trim() ? `${draft.amount.trim()} сум` : '',
  ].filter(Boolean)
  return parts.join(' · ') || 'Рецепт'
}

export function parseAmount(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return undefined
  return Number(digits)
}

export function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function subscribeDrafts(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
