import { MESSAGE_TEMPLATES, renderTemplate, SAMPLE_VARS } from '../template'

type Props = {
  value: string
  selectedKey?: string
  onSelect: (key: string, body: string) => void
  previewVars?: Record<string, string>
  extra?: { key: string; name: string; hint: string; body: string }
}

export default function TemplatePicker({
  value,
  selectedKey,
  onSelect,
  previewVars,
  extra,
}: Props) {
  const vars = { ...SAMPLE_VARS, ...previewVars }
  const items = extra ? [extra, ...MESSAGE_TEMPLATES] : MESSAGE_TEMPLATES

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const active = selectedKey
          ? selectedKey === item.key
          : value.trim() === item.body.trim()
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key, item.body)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              active ? 'border-ink bg-paper' : 'border-line bg-card hover:border-ink/30'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted">{item.hint}</div>
              </div>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border ${
                  active ? 'border-ink bg-ink' : 'border-line'
                }`}
              />
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
              {renderTemplate(item.body, vars)}
            </pre>
          </button>
        )
      })}
    </div>
  )
}
