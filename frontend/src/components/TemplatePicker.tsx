import { renderTemplate, SAMPLE_VARS, smsMeta } from '../template'

export type CatalogTemplate = {
  id: string
  name: string
  hint: string
  kind?: string
  bodyRu: string
  bodyUz: string
  smsRu?: string
  smsUz?: string
}

type Props = {
  items: CatalogTemplate[]
  selectedId?: string | null
  lang?: 'ru' | 'uz' | 'both'
  onSelect: (item: CatalogTemplate) => void
  previewVars?: Record<string, string>
  smsLimit?: number
}

export default function TemplatePicker({
  items,
  selectedId,
  lang = 'ru',
  onSelect,
  previewVars,
  smsLimit,
}: Props) {
  const vars = { ...SAMPLE_VARS, ...previewVars }
  const showUz = lang === 'uz' || lang === 'both'
  const showRu = lang !== 'uz'

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const active = selectedId === item.id
        const smsRu = renderTemplate(item.smsRu || item.bodyRu, vars)
        const smsUz = renderTemplate(item.smsUz || item.bodyUz, vars)
        const smsPreview = showUz && !showRu ? smsUz : smsRu
        const meta = smsMeta(smsPreview, smsLimit)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              active ? 'border-ink bg-paper' : 'border-line bg-card hover:border-ink/30'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{item.name}</div>
                {item.hint ? <div className="text-xs text-muted">{item.hint}</div> : null}
              </div>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border ${
                  active ? 'border-ink bg-ink' : 'border-line'
                }`}
              />
            </div>
            {showRu && (
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
                {renderTemplate(item.bodyRu, vars)}
              </pre>
            )}
            {showUz && item.bodyUz.trim() && (
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
                {renderTemplate(item.bodyUz, vars)}
              </pre>
            )}
            {smsPreview ? (
              <div className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm text-muted">
                <div className="mb-1 text-[11px] uppercase tracking-wide">
                  SMS · {meta.chars} символов · {meta.parts}{' '}
                  {meta.parts === 1 ? 'часть' : 'части'}
                </div>
                {showRu ? smsRu : null}
                {showUz && smsUz ? (
                  <div className={showRu ? 'mt-1' : ''}>{smsUz}</div>
                ) : null}
              </div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
