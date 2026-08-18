import { useEffect, useRef, useState } from 'react'
import PhoneInput from './PhoneInput'
import { formatPersonName } from '../name'
import {
  formatPhoneInput,
  looksLikePhone,
  UZ_DEFAULT,
} from '../phone'
import type { Client } from '../types'

type Props = {
  clients: Client[]
  clientId: string
  fullName: string
  phone: string
  creating: boolean
  autoFocus?: boolean
  onSearch: (query: string) => void
  onSelect: (client: Client) => void
  onStartCreate: (draft: { fullName: string; phone: string }) => void
  onChangeName: (value: string) => void
  onChangePhone: (value: string) => void
  onClear: () => void
}

export default function ClientPicker({
  clients,
  clientId,
  fullName,
  phone,
  creating,
  autoFocus,
  onSearch,
  onSelect,
  onStartCreate,
  onChangeName,
  onChangePhone,
  onClear,
}: Props) {
  const [q, setQ] = useState('')
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch
  const picked = !creating && !!clientId

  useEffect(() => {
    if (!creating && !clientId) setQ('')
  }, [creating, clientId])

  useEffect(() => {
    if (creating || clientId) return
    const timer = window.setTimeout(
      () => onSearchRef.current(q),
      q.trim() ? 200 : 0,
    )
    return () => window.clearTimeout(timer)
  }, [q, creating, clientId])

  function startCreate() {
    if (looksLikePhone(q)) {
      onStartCreate({ fullName: '', phone: formatPhoneInput(q) || UZ_DEFAULT })
      return
    }
    onStartCreate({
      fullName: formatPersonName(q.trim()),
      phone: UZ_DEFAULT,
    })
  }

  if (picked) {
    return (
      <div>
        <span className="mb-1 block text-sm text-muted">Клиент</span>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate font-medium">{fullName || 'Клиент'}</div>
            <div className="text-sm text-muted">{formatPhoneInput(phone) || phone}</div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-sm text-muted hover:text-ink"
          >
            Изменить
          </button>
        </div>
      </div>
    )
  }

  if (creating) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Новый клиент</span>
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-muted hover:text-ink"
          >
            Найти
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">ФИО</span>
          <input
            required
            minLength={2}
            autoFocus={autoFocus}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={fullName}
            onChange={(e) => onChangeName(formatPersonName(e.target.value))}
            enterKeyHint="next"
            className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
          />
        </label>
        <PhoneInput required value={phone} onChange={onChangePhone} enterKeyHint="next" />
      </div>
    )
  }

  const hint = q.trim()
    ? looksLikePhone(q)
      ? formatPhoneInput(q)
      : formatPersonName(q.trim())
    : ''

  return (
    <div>
      <span className="mb-1 block text-sm text-muted">Клиент</span>
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Имя или телефон"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
      />
      <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
        {clients.length === 0 ? (
          q.trim() ? (
            <button
              type="button"
              onClick={startCreate}
              className="w-full px-3 py-3 text-left text-sm hover:bg-paper/70"
            >
              <span className="font-medium text-brass-dark">Нет в списке — создать</span>
              {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
            </button>
          ) : (
            <div className="px-3 py-3 text-sm text-muted">Пока нет клиентов</div>
          )
        ) : (
          clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onSelect(client)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-paper/70"
            >
              <span className="min-w-0">
                <span className="block truncate">{client.fullName}</span>
                <span className="block text-xs text-muted">
                  {formatPhoneInput(client.phone) || client.phone}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={startCreate}
        className="mt-2 w-full rounded-xl border border-brass/60 bg-brass/10 px-3 py-2.5 text-left text-sm font-medium text-brass-dark hover:bg-brass/20"
      >
        Новый клиент
        {hint ? <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span> : null}
      </button>
    </div>
  )
}
