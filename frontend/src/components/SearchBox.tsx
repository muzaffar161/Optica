import type { FormEvent } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
}

export default function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = '',
}: Props) {
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit?.()
  }

  return (
    <form
      onSubmit={submit}
      className={`flex w-full overflow-hidden rounded-xl border border-line bg-card ${className}`}
    >
      <span className="flex items-center pl-3 text-muted" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
      />
      <button
        type="submit"
        className="bg-ink px-3 text-sm text-white hover:bg-ink-soft md:px-3.5"
        aria-label="Найти"
      >
        <span className="md:hidden">OK</span>
        <span className="hidden md:inline">Найти</span>
      </button>
    </form>
  )
}
