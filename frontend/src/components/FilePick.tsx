import { useRef } from 'react'

type Props = {
  file: File | null
  onChange: (file: File | null) => void
  accept?: string
  emptyLabel?: string
  buttonLabel?: string
}

export default function FilePick({
  file,
  onChange,
  accept = 'image/*',
  emptyLabel = 'Нажмите, чтобы выбрать фото',
  buttonLabel = 'Выбрать',
}: Props) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-paper px-3 py-3 text-left hover:border-brass"
      >
        <span className={file ? '' : 'text-muted'}>
          {file ? file.name : emptyLabel}
        </span>
        <span className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white">
          {buttonLabel}
        </span>
      </button>
    </div>
  )
}
