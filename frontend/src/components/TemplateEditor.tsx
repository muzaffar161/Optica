import { useRef } from 'react'
import { insertAtCursor, renderTemplate, SAMPLE_VARS, TEMPLATE_VARS } from '../template'

type Props = {
  value: string
  onChange: (value: string) => void
  previewVars?: Record<string, string>
}

export default function TemplateEditor({ value, onChange, previewVars }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)

  function insert(key: string) {
    const el = area.current
    const token = `{${key}}`
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const { next, caret } = insertAtCursor(value, token, start, end)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  const preview = renderTemplate(value, {
    ...SAMPLE_VARS,
    ...previewVars,
  })

  return (
    <div>
      <textarea
        ref={area}
        required
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {TEMPLATE_VARS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => insert(item.key)}
            className="rounded-full border border-brass/40 bg-paper px-3 py-1.5 text-xs text-ink hover:border-brass"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2.5 text-sm text-muted">
        <div className="mb-1 text-[11px] uppercase tracking-wide">Как увидит клиент</div>
        {preview}
      </div>
    </div>
  )
}
