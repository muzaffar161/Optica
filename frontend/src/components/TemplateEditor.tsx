import { useRef } from 'react'
import { insertAtCursor, renderTemplate, SAMPLE_VARS, TEMPLATE_VARS, smsMeta } from '../template'

type Props = {
  value: string
  onChange: (value: string) => void
  previewVars?: Record<string, string>
  required?: boolean
  sms?: boolean
  smsLimit?: number | null
  toLatin?: boolean
  lang?: 'ru' | 'uz'
  chips?: ReadonlyArray<{ key: string; label: string }>
}

export default function TemplateEditor({
  value,
  onChange,
  previewVars,
  required = true,
  sms = false,
  smsLimit,
  toLatin = false,
  lang = 'ru',
  chips = TEMPLATE_VARS,
}: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const vars = { ...SAMPLE_VARS, ...previewVars }

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

  const preview = renderTemplate(value, vars)
  const meta = sms ? smsMeta(preview, smsLimit, toLatin, lang) : null

  return (
    <div>
      <textarea
        ref={area}
        required={required}
        rows={sms ? 4 : 8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-3 py-2.5 outline-none ${
          meta?.over ? 'border-red-400' : 'border-line'
        }`}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((item) => (
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
      {meta ? (
        <div className={`mt-2 text-xs ${meta.over ? 'text-red-600' : 'text-muted'}`}>
          {meta.unlimited
            ? `${meta.chars} символов, без обрезки`
            : `${meta.chars} / ${meta.limit}${
                meta.over ? ' — больше лимита, уберите лишнее' : ` · осталось ${meta.remaining}`
              }`}
        </div>
      ) : null}
      <div className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2.5 text-sm text-muted">
        <div className="mb-1 text-[11px] uppercase tracking-wide">
          Как увидит клиент{toLatin ? ' · латиница' : ''}
        </div>
        {meta?.text ?? preview}
      </div>
    </div>
  )
}
