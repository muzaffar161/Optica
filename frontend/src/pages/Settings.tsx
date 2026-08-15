import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import { renderTemplate, SAMPLE_VARS } from '../template'
import type { Settings } from '../types'
import { useAuth } from '../AuthContext'
import { canEdit } from '../access'
import PhoneInput from '../components/PhoneInput'
import ThemePicker from '../components/ThemePicker'
import TemplatePicker from '../components/TemplatePicker'
import { applyTheme } from '../themes'

const ARCHIVE_DAYS = [3, 7, 10, 14, 30, 60, 90]

export default function SettingsPage() {
  const toast = useToast()
  const { user, patchUser } = useAuth()
  const writable = canEdit(user, 'settings')
  const [form, setForm] = useState<Settings | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api<Settings>('/settings')
      .then(setForm)
      .catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setPending(true)
    try {
      const saved = await api<Settings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          address: form.address,
          landmark: form.landmark,
          phone: form.phone ?? '',
          hours: form.hours ?? '',
          theme: form.theme || 'atelier',
          archiveAfterDays: form.archiveAfterDays ?? 10,
          templateKey: form.templateCustom ? form.templateKey : 'platform',
        }),
      })
      setForm(saved)
      applyTheme(saved.theme)
      patchUser({ theme: saved.theme })
      toast('Настройки сохранены')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  if (!form) {
    return <p className="text-muted">Загрузка…</p>
  }

  const preview = renderTemplate(form.template, {
    ...SAMPLE_VARS,
    opticsName: form.opticsName || SAMPLE_VARS.opticsName,
    address: form.address || SAMPLE_VARS.address,
    landmark: form.landmark || SAMPLE_VARS.landmark,
    hours: form.hours || SAMPLE_VARS.hours,
    phone: form.phone || SAMPLE_VARS.phone,
  })

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div>
        <h1 className="font-display text-3xl">Настройки</h1>
        <p className="mt-1 text-sm text-muted">
          Адрес, тема, архив и вид сообщения клиенту.
        </p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <section className="space-y-4 rounded-2xl border border-line bg-card p-5">
          <div className="font-display text-xl">Салон</div>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Название оптики</span>
            <input
              readOnly
              value={form.opticsName}
              className="w-full cursor-default rounded-xl border border-line bg-paper px-3 py-2.5 text-muted outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Адрес</span>
            <input
              required
              value={form.address}
              readOnly={!writable}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={`w-full rounded-xl border border-line px-3 py-2.5 outline-none ${writable ? '' : 'cursor-default bg-paper text-muted'}`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Ориентир</span>
            <input
              required
              value={form.landmark}
              readOnly={!writable}
              onChange={(e) => setForm({ ...form, landmark: e.target.value })}
              className={`w-full rounded-xl border border-line px-3 py-2.5 outline-none ${writable ? '' : 'cursor-default bg-paper text-muted'}`}
            />
          </label>
          {writable ? (
            <div>
              <PhoneInput
                label="Телефон салона"
                value={form.phone || ''}
                onChange={(phone) => setForm({ ...form, phone })}
              />
              <span className="mt-1 block text-xs text-muted">
                Попадёт в сообщение, если в шаблоне есть «телефон салона».
              </span>
            </div>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Телефон салона</span>
              <input
                readOnly
                value={form.phone || 'не указан'}
                className="w-full cursor-default rounded-xl border border-line bg-paper px-3 py-2.5 text-muted outline-none"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Часы работы</span>
            <input
              value={form.hours ?? ''}
              readOnly={!writable}
              placeholder="9:00–20:00"
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className={`w-full rounded-xl border border-line px-3 py-2.5 outline-none ${writable ? '' : 'cursor-default bg-paper text-muted'}`}
            />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <div>
            <div className="font-display text-xl">Тема</div>
            <p className="mt-1 text-sm text-muted">
              Атмосфера салона. Выберите, как удобнее смотреть каждый день.
            </p>
          </div>
          <ThemePicker
            value={form.theme}
            disabled={!writable}
            onChange={(theme) => {
              setForm({ ...form, theme })
            }}
          />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <div>
            <div className="font-display text-xl">Архив</div>
            <p className="mt-1 text-sm text-muted">
              Заказы, клиенты и журнал сами уходят в архив через это число дней.
              Вручную можно убрать раньше или вернуть обратно.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ARCHIVE_DAYS.map((days) => (
              <button
                key={days}
                type="button"
                disabled={!writable}
                onClick={() => setForm({ ...form, archiveAfterDays: days })}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  (form.archiveAfterDays ?? 10) === days
                    ? 'bg-ink text-white'
                    : 'border border-line text-muted'
                }`}
              >
                {days} дн.
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <div>
            <div className="font-display text-xl">Сообщение клиенту</div>
            <p className="mt-1 text-sm text-muted">
              Короткий SMS-текст или карточка с линзой, оправой и адресом.
            </p>
          </div>
          {writable ? (
            <>
              {form.templateCustom && (
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, templateCustom: false, templateKey: 'platform' })
                  }
                  className="text-sm text-muted hover:text-ink hover:underline"
                >
                  Вернуть шаблон главной админки
                </button>
              )}
              <TemplatePicker
                value={form.template}
                selectedKey={
                  form.templateCustom === false ? undefined : form.templateKey
                }
                previewVars={{
                  opticsName: form.opticsName,
                  address: form.address,
                  landmark: form.landmark,
                  hours: form.hours || SAMPLE_VARS.hours,
                  phone: form.phone || SAMPLE_VARS.phone,
                }}
                onSelect={(key, body) =>
                  setForm({
                    ...form,
                    templateKey: key,
                    template: body,
                    templateCustom: true,
                  })
                }
              />
            </>
          ) : (
            <pre className="whitespace-pre-wrap rounded-xl bg-paper px-3 py-2.5 font-sans text-sm text-muted">
              {preview}
            </pre>
          )}
        </section>

        {writable && (
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-60 md:w-auto"
          >
            {pending ? 'Сохраняем…' : 'Сохранить'}
          </button>
        )}
      </form>
    </div>
  )
}
