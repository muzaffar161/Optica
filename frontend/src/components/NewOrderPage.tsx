import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { hasCatalog, hasRx } from '../types'
import { startNew, getCurrent, hasContent, setCurrent, holdCurrent } from '../orderDraft'
import { UZ_DEFAULT } from '../phone'
import NewOrderSheet from './NewOrderSheet'
import NewRxOrderSheet from './NewRxOrderSheet'

export default function NewOrderPage() {
  const { user } = useAuth()
  const catalog = hasCatalog(user)
  const rx = hasRx(user)
  const [kind, setKind] = useState<'catalog' | 'rx' | null>(() => {
    const current = getCurrent()
    if (current?.kind === 'rx' && rx) return 'rx'
    if (current?.kind === 'catalog' && catalog) return 'catalog'
    if (catalog && !rx) return 'catalog'
    if (rx && !catalog) return 'rx'
    return null
  })

  if (!kind) {
    return (
      <div className="flex h-dvh flex-col bg-card">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5">
          <h2 className="min-w-0 flex-1 font-display text-xl">Новый заказ</h2>
          <Link
            to="/"
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-muted hover:bg-paper hover:text-ink"
            aria-label="Закрыть"
          >
            ✕
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 p-4">
          <p className="mb-2 text-sm text-muted">Какой заказ создать?</p>
          {catalog && (
            <button
              type="button"
              onClick={() => {
                if (hasContent(getCurrent())) holdCurrent()
                else setCurrent(null)
                startNew(UZ_DEFAULT, 'catalog')
                setKind('catalog')
              }}
              className="rounded-2xl border border-line bg-paper px-4 py-5 text-left hover:border-brass"
            >
              <div className="font-display text-xl">Из каталога</div>
              <div className="mt-1 text-sm text-muted">Товары с фото, как сейчас</div>
            </button>
          )}
          {rx && (
            <button
              type="button"
              onClick={() => {
                if (hasContent(getCurrent())) holdCurrent()
                else setCurrent(null)
                startNew(UZ_DEFAULT, 'rx')
                setKind('rx')
              }}
              className="rounded-2xl border border-line bg-paper px-4 py-5 text-left hover:border-brass"
            >
              <div className="font-display text-xl">По рецепту</div>
              <div className="mt-1 text-sm text-muted">
                OD / OS, линза, оправа, сумма
              </div>
            </button>
          )}
        </div>
      </div>
    )
  }

  if (kind === 'rx') return <NewRxOrderSheet />
  return <NewOrderSheet />
}
