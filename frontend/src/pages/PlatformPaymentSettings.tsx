import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import FilePick from '../components/FilePick'
import { formatPersonName, personName } from '../name'
import type { PaymentSettings } from '../payment'

export default function PlatformPaymentSettings() {
  const toast = useToast()
  const [form, setForm] = useState<PaymentSettings | null>(null)
  const [qr, setQr] = useState<File | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    const row = await api<PaymentSettings>('/platform/payment-settings')
    setForm({
      ...row,
      cardOwner: formatPersonName(row.cardOwner),
      clickEnabled: row.clickEnabled !== false,
      cardEnabled: row.cardEnabled !== false,
    })
    setQr(null)
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.clickEnabled && !form.cardEnabled) {
      toast('Включите хотя бы один способ оплаты', 'err')
      return
    }
    setPending(true)
    try {
      await api('/platform/payment-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clickInstructions: form.clickInstructions,
          clickAccount: form.clickAccount,
          cardInstructions: form.cardInstructions,
          cardNumber: form.cardNumber,
          cardOwner: personName(form.cardOwner),
          paymentExpireHours: form.paymentExpireHours,
          clickEnabled: form.clickEnabled,
          cardEnabled: form.cardEnabled,
        }),
      })
      if (qr) {
        const data = new FormData()
        data.append('qr', qr)
        await api('/platform/payment-settings/qr', { method: 'POST', body: data })
      }
      toast('Реквизиты сохранены')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  if (!form) return <p className="text-muted">Загрузка…</p>

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="font-display text-3xl">Реквизиты оплаты</h1>
        <p className="mt-1 text-sm text-muted">
          QR и текст, которые видит владелец на экране оплаты. Галочками включаете способы.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-xl">Click</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.clickEnabled}
              onChange={(e) => setForm({ ...form, clickEnabled: e.target.checked })}
            />
            Показывать
          </label>
        </div>
        <div>
          <div className="mb-2 text-sm text-muted">QR-код</div>
          {form.clickQrPath && (
            <img
              src={form.clickQrPath}
              alt="QR Click"
              className="mb-3 max-h-44 rounded-xl border border-line bg-white p-2"
            />
          )}
          <FilePick
            file={qr}
            onChange={setQr}
            emptyLabel="Файл ещё не выбран"
            buttonLabel="Загрузить QR"
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Инструкция</span>
          <textarea
            value={form.clickInstructions}
            onChange={(e) => setForm({ ...form, clickInstructions: e.target.value })}
            className="h-24 w-full rounded-xl border border-line px-3 py-2.5"
            placeholder="Оплатите по QR. В комментарии укажите номер платежа."
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-xl">Перевод на карту</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.cardEnabled}
              onChange={(e) => setForm({ ...form, cardEnabled: e.target.checked })}
            />
            Показывать
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Получатель</span>
          <input
            value={form.cardOwner}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setForm({ ...form, cardOwner: formatPersonName(e.target.value) })}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Номер карты / счёта</span>
          <input
            value={form.cardNumber}
            onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Инструкция</span>
          <textarea
            value={form.cardInstructions}
            onChange={(e) => setForm({ ...form, cardInstructions: e.target.value })}
            className="h-24 w-full rounded-xl border border-line px-3 py-2.5"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <div className="font-display text-xl">Срок платежа</div>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Часов до истечения</span>
          <input
            type="number"
            min={1}
            max={168}
            value={form.paymentExpireHours}
            onChange={(e) => setForm({ ...form, paymentExpireHours: Number(e.target.value) || 24 })}
            className="w-full rounded-xl border border-line px-3 py-2.5"
          />
        </label>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-ink py-3 text-sm font-medium text-white disabled:opacity-60 md:w-auto md:px-6"
      >
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  )
}
