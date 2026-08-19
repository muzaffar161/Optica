import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import type { CatalogTemplate } from '../components/TemplatePicker'
import type { Settings } from '../types'
import { SAMPLE_VARS } from '../template'
import { useAuth } from '../AuthContext'
import { canEdit } from '../access'
import PhoneInput from '../components/PhoneInput'
import ThemePicker from '../components/ThemePicker'
import TemplatePicker from '../components/TemplatePicker'
import { applyTheme, THEMES } from '../themes'

const ARCHIVE_DAYS = [3, 7, 10, 14, 30, 60, 90]
const CHECKUP_MONTHS = [3, 6, 12]
const CHECKUP_DAYS = [1, 5, 10, 15, 20, 25]

type SectionId = 'salon' | 'theme' | 'archive' | 'checkup' | 'message'

function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" className="shrink-0 text-muted" aria-hidden>
      <path
        d="M1 1l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${className}`}
    >
      {children}
    </span>
  )
}

function Row({
  icon,
  title,
  value,
  onClick,
}: {
  icon: ReactNode
  title: string
  value?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-paper/70"
    >
      {icon}
      <span className="min-w-0 flex-1 font-medium">{title}</span>
      {value ? (
        <span className="max-w-[42%] truncate text-sm text-muted">{value}</span>
      ) : null}
      <Chevron />
    </button>
  )
}

export default function SettingsPage() {
  const toast = useToast()
  const { user, patchUser } = useAuth()
  const writable = canEdit(user, 'settings')
  const [form, setForm] = useState<Settings | null>(null)
  const [templates, setTemplates] = useState<CatalogTemplate[]>([])
  const [pending, setPending] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [section, setSection] = useState<SectionId | null>(null)

  useEffect(() => {
    Promise.all([api<Settings>('/settings'), api<CatalogTemplate[]>('/settings/templates')])
      .then(([s, list]) => {
        setTemplates(list)
        setForm(s.templateId ? s : { ...s, templateId: list[0]?.id ?? s.templateId })
      })
      .catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function save(e?: FormEvent) {
    e?.preventDefault()
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
          templateId: form.templateId,
          messageLang: form.messageLang || 'ru',
          checkupRemindEnabled: form.checkupRemindEnabled !== false,
          checkupIntervalMonths: form.checkupIntervalMonths ?? 6,
          checkupNotifyDay: form.checkupNotifyDay ?? 1,
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

  async function remindNow() {
    if (!form) return
    setReminding(true)
    try {
      const saved = await api<Settings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          checkupRemindEnabled: form.checkupRemindEnabled !== false,
          checkupIntervalMonths: form.checkupIntervalMonths ?? 6,
          checkupNotifyDay: form.checkupNotifyDay ?? 1,
        }),
      })
      setForm(saved)
      const result = await api<{
        sent: number
        failed: number
        skipped: number
        cohort: string
      }>('/settings/checkup-remind', { method: 'POST' })
      const bits = [
        result.sent ? `отправлено ${result.sent}` : '',
        result.skipped ? `уже получали ${result.skipped}` : '',
        result.failed ? `не дошло ${result.failed}` : '',
      ].filter(Boolean)
      toast(
        result.cohort
          ? `Когорта «${result.cohort}»: ${bits.join(', ') || 'никого в этой волне'}`
          : bits.join(', ') || 'Никого в этой волне',
      )
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setReminding(false)
    }
  }

  if (!form) {
    return <p className="text-muted">Загрузка…</p>
  }

  const themeName = THEMES.find((item) => item.key === (form.theme || 'atelier'))?.name
  const lang = form.messageLang || 'ru'
  const currentTpl = templates.find((row) => row.id === form.templateId) || templates[0]
  const templateName = currentTpl?.name || 'сообщение'
  const langLabel = lang === 'both' ? 'RU + UZ' : lang === 'uz' ? 'o‘zbek' : 'русский'

  const titles: Record<SectionId, string> = {
    salon: 'Салон',
    theme: 'Тема',
    archive: 'Архив',
    checkup: 'Осмотр',
    message: 'Сообщение',
  }

  if (section) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-8">
        <button
          type="button"
          onClick={() => setSection(null)}
          className="flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden>
            <path
              d="M8.5 1 1.5 8l7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Настройки
        </button>
        <h1 className="font-display text-3xl">{titles[section]}</h1>

        <form onSubmit={save} className="space-y-4">
          {section === 'salon' && (
            <section className="space-y-4 rounded-2xl border border-line bg-card p-5">
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
          )}

          {section === 'theme' && (
            <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
              <p className="text-sm text-muted">Как удобнее смотреть каждый день.</p>
              <ThemePicker
                value={form.theme}
                disabled={!writable}
                onChange={(theme) => setForm({ ...form, theme })}
              />
            </section>
          )}

          {section === 'archive' && (
            <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
              <p className="text-sm text-muted">
                Заказы, клиенты и журнал сами уходят в архив через это число дней.
              </p>
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
          )}

          {section === 'checkup' && (
            <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted">
                  Кто был в январе — получит одно общее сообщение в июле, в выбранный день
                  в 9:00.
                </p>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!writable}
                    checked={form.checkupRemindEnabled !== false}
                    onChange={(e) =>
                      setForm({ ...form, checkupRemindEnabled: e.target.checked })
                    }
                  />
                  Вкл.
                </label>
              </div>
              <div>
                <div className="mb-2 text-sm text-muted">Через сколько месяцев</div>
                <div className="flex flex-wrap gap-2">
                  {CHECKUP_MONTHS.map((months) => (
                    <button
                      key={months}
                      type="button"
                      disabled={!writable}
                      onClick={() => setForm({ ...form, checkupIntervalMonths: months })}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        (form.checkupIntervalMonths ?? 6) === months
                          ? 'bg-ink text-white'
                          : 'border border-line text-muted'
                      }`}
                    >
                      {months} мес.
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm text-muted">День месяца для рассылки</div>
                <div className="flex flex-wrap gap-2">
                  {CHECKUP_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      disabled={!writable}
                      onClick={() => setForm({ ...form, checkupNotifyDay: day })}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        (form.checkupNotifyDay ?? 1) === day
                          ? 'bg-ink text-white'
                          : 'border border-line text-muted'
                      }`}
                    >
                      {day}-е
                    </button>
                  ))}
                </div>
              </div>
              {writable && (
                <button
                  type="button"
                  disabled={reminding}
                  onClick={() => void remindNow()}
                  className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-60"
                >
                  {reminding ? 'Отправляем…' : 'Отправить эту волну сейчас'}
                </button>
              )}
            </section>
          )}

          {section === 'message' && (
            <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
              <p className="text-sm text-muted">
                Русский, узбекский или оба. Telegram — полный текст бесплатно. SMS — короткая
                версия: оба языка = 2 SMS, лимит {form.smsCharLimit ?? 70} символов.
              </p>
              {writable ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['ru', 'Русский'],
                        ['uz', 'O‘zbek'],
                        ['both', 'Оба'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm({ ...form, messageLang: key })}
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          lang === key ? 'bg-ink text-white' : 'border border-line text-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <TemplatePicker
                    items={templates}
                    selectedId={form.templateId || currentTpl?.id}
                    lang={lang}
                    smsLimit={form.smsCharLimit}
                    previewVars={{
                      opticsName: form.opticsName,
                      address: form.address,
                      landmark: form.landmark,
                      hours: form.hours || SAMPLE_VARS.hours,
                      phone: form.phone || SAMPLE_VARS.phone,
                    }}
                    onSelect={(item) =>
                      setForm({
                        ...form,
                        templateId: item.id,
                        templateKey: item.id,
                        template: item.bodyRu,
                        templateCustom: true,
                      })
                    }
                  />
                </>
              ) : (
                <p className="text-sm text-muted">
                  {templateName} · {langLabel}
                </p>
              )}
            </section>
          )}

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

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div>
        <h1 className="font-display text-3xl">Настройки</h1>
        <p className="mt-1 text-sm text-muted">{form.opticsName}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <Row
          title="Салон"
          value={form.address}
          onClick={() => setSection('salon')}
          icon={
            <Icon className="bg-brass">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2.5 13.5V7.2L8 3.2l5.5 4v6.3H9.6V10H6.4v3.5H2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </Icon>
          }
        />
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        <Row
          title="Тема"
          value={themeName}
          onClick={() => setSection('theme')}
          icon={
            <Icon className="bg-ink">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 2.8v10.4M2.8 8h10.4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Icon>
          }
        />
        <Row
          title="Архив"
          value={`${form.archiveAfterDays ?? 10} дн.`}
          onClick={() => setSection('archive')}
          icon={
            <Icon className="bg-ink-soft">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2.5 4.2h11v2.2h-11V4.2Zm1 2.2v6.4h9V6.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </Icon>
          }
        />
        <Row
          title="Осмотр"
          value={
            form.checkupRemindEnabled === false
              ? 'выкл'
              : `${form.checkupIntervalMonths ?? 6} мес.`
          }
          onClick={() => setSection('checkup')}
          icon={
            <Icon className="bg-brass-dark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M2.4 8c1.4-2.8 3.3-4.2 5.6-4.2S12.2 5.2 13.6 8c-1.4 2.8-3.3 4.2-5.6 4.2S3.8 10.8 2.4 8Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </Icon>
          }
        />
        <Row
          title="Сообщение"
          value={`${templateName} · ${langLabel}`}
          onClick={() => setSection('message')}
          icon={
            <Icon className="bg-muted">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M3 3.5h10v7.2H6.2L3 13V3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </Icon>
          }
        />
      </div>
    </div>
  )
}
