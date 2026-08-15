import { formatPhoneInput, isPhoneValid, UZ_DEFAULT } from '../phone'

type Props = {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
  enterKeyHint?: 'next' | 'done'
  label?: string
}

export default function PhoneInput({
  value,
  onChange,
  required,
  className = '',
  enterKeyHint,
  label = 'Телефон',
}: Props) {
  const showError = value.trim() !== '' && value !== UZ_DEFAULT && !isPhoneValid(value)

  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input
        required={required}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onFocus={() => {
          if (!value.trim()) onChange(UZ_DEFAULT)
        }}
        onChange={(e) => onChange(formatPhoneInput(e.target.value))}
        placeholder="+998 90 123 45 67"
        enterKeyHint={enterKeyHint}
        className={`w-full rounded-xl border px-3 py-2.5 outline-none ${
          showError ? 'border-red-400' : 'border-line'
        } ${className}`}
      />
      <p className="mt-1 hidden text-xs text-muted md:block">
        По умолчанию +998, можно стереть и вписать другой код страны.
      </p>
      {showError && (
        <p className="mt-1 text-xs text-red-600">Проверьте номер — формат неверный.</p>
      )}
    </label>
  )
}
