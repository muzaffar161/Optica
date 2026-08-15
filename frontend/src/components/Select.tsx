import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type SelectOption = {
  value: string
  label: string
  hint?: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
  searchable?: boolean
  searchPlaceholder?: string
  required?: boolean
  className?: string
  triggerClassName?: string
  footer?: ReactNode
  onSearch?: (query: string) => void
}

const CLOSE_EVENT = 'optika-select-close'

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Выберите',
  label,
  searchable,
  searchPlaceholder = 'Поиск',
  required,
  className = '',
  triggerClassName = '',
  footer,
  onSearch,
}: Props) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 })
  const selected = options.find((o) => o.value === value)
  const filtered = q.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q.trim().toLowerCase()) ||
          o.hint?.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : options

  function place() {
    const el = trigger.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 220)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    const height = menu.current?.offsetHeight ?? Math.min(options.length, 6) * 42 + 8
    const gap = 6
    const spaceBelow = window.innerHeight - r.bottom - 8
    const spaceAbove = r.top - 8
    const openAbove = spaceBelow < height + gap && spaceAbove > spaceBelow
    const top = openAbove
      ? Math.max(8, r.top - height - gap)
      : Math.min(r.bottom + gap, window.innerHeight - height - 8)
    setBox({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open, q, options.length])

  useEffect(() => {
    if (!open) {
      setQ('')
      return
    }
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: id }))
    function onCloseOthers(e: Event) {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false)
    }
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (root.current?.contains(t) || menu.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener(CLOSE_EVENT, onCloseOthers)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(CLOSE_EVENT, onCloseOthers)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, id])

  return (
    <div ref={root} className={`relative ${className}`}>
      {label && <span className="mb-1 block text-sm text-muted">{label}</span>}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-left outline-none ${triggerClassName}`}
      >
        <span className={selected ? '' : 'text-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden className="shrink-0 text-muted">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            style={{ top: box.top, left: box.left, width: box.width }}
            className="fixed z-50 overflow-hidden rounded-xl border border-line bg-card shadow-lg"
          >
            {searchable && (
              <div className="border-b border-line p-2">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    onSearch?.(e.target.value)
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
                />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted">Ничего не найдено</div>
              )}
              {filtered.map((option) => {
                const active = option.value === value
                return (
                  <button
                    key={option.value || 'empty'}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                      active ? 'bg-paper font-medium' : 'hover:bg-paper/70'
                    }`}
                  >
                    <span>
                      {option.label}
                      {option.hint && (
                        <span className="mt-0.5 block text-xs font-normal text-muted">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {active && <span className="text-brass-dark">✓</span>}
                  </button>
                )
              })}
            </div>
            {footer && <div className="border-t border-line p-2">{footer}</div>}
          </div>,
          document.body,
        )}
    </div>
  )
}
