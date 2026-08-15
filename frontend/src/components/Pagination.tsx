type Props = {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

export default function Pagination({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3 text-sm text-muted md:px-4">
      <span className="min-w-0 truncate">
        <span className="md:hidden">
          {page}/{pages}
        </span>
        <span className="hidden md:inline">
          {total} {plural(total)} · стр. {page} из {pages}
        </span>
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-line px-3 py-1 disabled:opacity-40"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-line px-3 py-1 disabled:opacity-40"
        >
          Далее
        </button>
      </div>
    </div>
  )
}

function plural(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'запись'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'записи'
  return 'записей'
}
