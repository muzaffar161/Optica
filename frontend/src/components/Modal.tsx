import type { ReactNode } from 'react'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export default function Modal({ title, onClose, children, wide }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink/40 p-0 backdrop-blur-[2px] md:items-start md:p-6">
      <div
        className={`flex min-h-full w-full flex-col border-line bg-card shadow-xl md:mt-10 md:min-h-0 md:rounded-2xl md:border ${
          wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center text-muted hover:text-ink"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 p-5">{children}</div>
      </div>
    </div>
  )
}
