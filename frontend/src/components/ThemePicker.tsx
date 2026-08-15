import { applyTheme, THEMES, type ThemeKey } from '../themes'

type Props = {
  value?: string
  onChange: (key: ThemeKey) => void
  disabled?: boolean
}

export default function ThemePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {THEMES.map((theme) => {
        const active = (value || 'atelier') === theme.key
        return (
          <button
            key={theme.key}
            type="button"
            disabled={disabled}
            onClick={() => {
              applyTheme(theme.key)
              onChange(theme.key)
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              active ? 'border-ink bg-paper' : 'border-line bg-card hover:border-ink/30'
            }`}
          >
            <div className="mb-3 flex gap-1.5">
              {theme.swatches.map((color) => (
                <span
                  key={color}
                  className="h-7 flex-1 rounded-lg border border-black/5"
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="font-medium">{theme.name}</div>
            <div className="mt-0.5 text-xs text-muted">{theme.hint}</div>
          </button>
        )
      })}
    </div>
  )
}
