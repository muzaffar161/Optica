export default function ArchiveTabs({
  archive,
  onChange,
}: {
  archive: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-full px-3 py-1.5 text-sm ${
          !archive
            ? 'bg-ink text-white'
            : 'border border-line bg-card text-muted hover:text-ink'
        }`}
      >
        Актуальные
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-full px-3 py-1.5 text-sm ${
          archive
            ? 'bg-ink text-white'
            : 'border border-line bg-card text-muted hover:text-ink'
        }`}
      >
        Архив
      </button>
    </div>
  )
}

export function ArchiveAction({
  archived,
  onToggle,
  disabled,
}: {
  archived?: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        archived
          ? 'border border-line bg-card text-ink hover:bg-paper'
          : 'bg-ink text-white hover:bg-ink-soft'
      }`}
    >
      {archived ? 'Вернуть' : 'В архив'}
    </button>
  )
}
