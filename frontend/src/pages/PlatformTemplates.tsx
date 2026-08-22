import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import TemplateEditor from '../components/TemplateEditor'
import type { CatalogTemplate } from '../components/TemplatePicker'
import { renderTemplate, SAMPLE_VARS, smsMeta, prepareSms, DEFAULT_SMS_CHAR_LIMIT, MIN_SMS_CHAR_LIMIT, MAX_SMS_CHAR_LIMIT, clampSmsCharLimit } from '../template'

const EMPTY_SMS_RU = '{firstName}, заказ готов. {opticsName}, {address}'
const EMPTY_SMS_UZ = '{firstName}, buyurtma tayyor. {opticsName}, {address}'
const WELCOME_CHIPS = [
  { key: 'firstName', label: 'Имя' },
  { key: 'fullName', label: 'ФИО' },
  { key: 'link', label: 'Ссылка на бота' },
]

type ProductSms = {
  balance: number
  inBowls?: number
  botLink: string
  smsCharLimit: number
  smsToLatin: boolean
  smsViaDevice?: boolean
  transactions: { id: string; amount: number; description: string; createdAt: string }[]
}

function isWelcome(item: CatalogTemplate) {
  return item.kind === 'welcome' || item.id === 'tpl_welcome'
}

export default function PlatformTemplates() {
  const toast = useToast()
  const [items, setItems] = useState<CatalogTemplate[]>([])
  const [product, setProduct] = useState<ProductSms | null>(null)
  const [draft, setDraft] = useState<CatalogTemplate | null>(null)
  const [tab, setTab] = useState<'telegram' | 'sms'>('telegram')
  const [botLink, setBotLink] = useState('')
  const [smsCharLimit, setSmsCharLimit] = useState(DEFAULT_SMS_CHAR_LIMIT)
  const [smsToLatin, setSmsToLatin] = useState(false)
  const [smsViaDevice, setSmsViaDevice] = useState(false)
  const [smsDelta, setSmsDelta] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const [list, sms] = await Promise.all([
      api<CatalogTemplate[]>('/platform/templates'),
      api<ProductSms>('/platform/product-sms'),
    ])
    setItems(list)
    setProduct(sms)
    setBotLink(sms.botLink || '')
    setSmsCharLimit(clampSmsCharLimit(sms.smsCharLimit))
    setSmsToLatin(Boolean(sms.smsToLatin))
    setSmsViaDevice(Boolean(sms.smsViaDevice))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  function open(item: CatalogTemplate) {
    setTab(isWelcome(item) ? 'sms' : 'telegram')
    setDraft({
      ...item,
      smsRu: item.smsRu || '',
      smsUz: item.smsUz || '',
    })
  }

  async function addTemplate() {
    setPending(true)
    try {
      const created = await api<CatalogTemplate>('/platform/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: `Шаблон ${items.filter((row) => !isWelcome(row)).length + 1}`,
          hint: '',
          bodyRu: 'Здравствуйте, {fullName}! Ваш заказ «{orderTitle}» готов.',
          bodyUz: "Assalomu alaykum, {fullName}! «{orderTitle}» buyurtmangiz tayyor.",
          smsRu: EMPTY_SMS_RU,
          smsUz: EMPTY_SMS_UZ,
        }),
      })
      toast('Добавлен шаблон')
      await load()
      open(created)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function persistSmsPrefs() {
    const saved = await api<ProductSms>('/platform/product-sms', {
      method: 'PATCH',
      body: JSON.stringify({
        botLink,
        smsCharLimit: clampSmsCharLimit(smsCharLimit),
        smsToLatin,
        smsViaDevice,
      }),
    })
    setProduct(saved)
    setBotLink(saved.botLink || '')
    setSmsCharLimit(clampSmsCharLimit(saved.smsCharLimit))
    setSmsToLatin(Boolean(saved.smsToLatin))
    setSmsViaDevice(Boolean(saved.smsViaDevice))
    return saved
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    setPending(true)
    try {
      const savedPrefs = await persistSmsPrefs()
      const viaPhone = Boolean(savedPrefs.smsViaDevice)
      const welcome = isWelcome(draft)
      const limit = clampSmsCharLimit(savedPrefs.smsCharLimit)
      const latin = Boolean(savedPrefs.smsToLatin)
      const link = botLink || SAMPLE_VARS.link
      const cap = welcome || !viaPhone ? limit : null
      const ru = smsMeta(renderTemplate(draft.smsRu || '', { ...SAMPLE_VARS, link }), cap, latin, 'ru')
      const uz = smsMeta(renderTemplate(draft.smsUz || '', { ...SAMPLE_VARS, link }), cap, latin, 'uz')
      if (cap != null && (ru.over || (draft.smsUz?.trim() && uz.over))) {
        toast(`SMS длиннее ${limit} символов — укоротите текст`, 'err')
        return
      }
      const saved = await api<CatalogTemplate>(`/platform/templates/${draft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          hint: draft.hint,
          bodyRu: welcome ? draft.smsRu || draft.bodyRu : draft.bodyRu,
          bodyUz: welcome ? draft.smsUz || draft.bodyUz : draft.bodyUz,
          smsRu: draft.smsRu || '',
          smsUz: draft.smsUz || '',
        }),
      })
      toast('Шаблон сохранён')
      setDraft(saved)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Удалить этот шаблон? Салоны, которые его выбрали, перейдут на другой.')) {
      return
    }
    setPending(true)
    try {
      await api(`/platform/templates/${id}`, { method: 'DELETE' })
      toast('Шаблон удалён')
      if (draft?.id === id) setDraft(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function saveProductSms(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const amount = Number(smsDelta)
      if (amount) {
        const withDelta = await api<ProductSms>('/platform/product-sms', {
          method: 'PATCH',
          body: JSON.stringify({
            amount,
            reason: amount > 0 ? 'Пополнение счёта продукта' : 'Списание со счёта продукта',
          }),
        })
        setProduct(withDelta)
      }
      setSmsDelta('')
      toast('Настройки SMS сохранены')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  const welcome = items.find(isWelcome)
  const salonItems = items.filter((row) => !isWelcome(row))
  const previewLink = botLink || SAMPLE_VARS.link

  if (draft) {
    const welcomeDraft = isWelcome(draft)
    const salonFree = smsViaDevice && !welcomeDraft
    const editorLimit = salonFree ? null : smsCharLimit
    const smsRuPreview = renderTemplate(draft.smsRu || '', { ...SAMPLE_VARS, link: previewLink })
    const smsUzPreview = renderTemplate(draft.smsUz || '', { ...SAMPLE_VARS, link: previewLink })
    const metaRu = smsMeta(smsRuPreview, editorLimit, smsToLatin, 'ru')
    const metaUz = smsMeta(smsUzPreview, editorLimit, smsToLatin, 'uz')
    const smsOver = metaRu.over || (!!draft.smsUz?.trim() && metaUz.over)
    return (
      <form onSubmit={save} className="mx-auto max-w-5xl space-y-5 pb-10">
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="text-sm text-muted hover:text-ink"
        >
          ← К списку
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl">{draft.name || 'Шаблон'}</h1>
            <p className="mt-1 text-sm text-muted">
              {welcomeDraft
                ? `Один SMS на номер, со счёта продукта. Салону не списывается.`
                : salonFree
                  ? `Telegram — кириллица. SMS с телефона салона не обрезается.`
                  : `Telegram — кириллица. SMS — короткий текст.`}
            </p>
          </div>
          <div className="flex gap-3">
            {!welcomeDraft && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void remove(draft.id)}
                className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink disabled:opacity-60"
              >
                Удалить
              </button>
            )}
            <button
              type="submit"
              disabled={
                pending ||
                smsOver ||
                !(welcomeDraft ? draft.smsRu?.trim() : draft.bodyRu.trim())
              }
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-line bg-card p-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Название</span>
            <input
              required
              minLength={2}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Подсказка</span>
            <input
              value={draft.hint}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
              className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Лимит SMS</span>
            <input
              type="number"
              min={MIN_SMS_CHAR_LIMIT}
              max={MAX_SMS_CHAR_LIMIT}
              value={smsCharLimit || ''}
              onChange={(e) => setSmsCharLimit(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              {welcomeDraft
                ? `Приветствие всегда через провайдера, до ${MAX_SMS_CHAR_LIMIT} символов.`
                : salonFree
                  ? 'С телефона салона не действует. Нужен, если включите провайдера.'
                  : `Сейчас ${smsCharLimit} символов, до ${MAX_SMS_CHAR_LIMIT}. Сохраняется вместе с шаблоном.`}
            </span>
          </label>
        </div>

        {!welcomeDraft && (
          <div className="flex gap-2">
            {(
              [
                ['telegram', 'Telegram'],
                ['sms', 'SMS'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  tab === key ? 'bg-ink text-white' : 'border border-line text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!welcomeDraft && tab === 'telegram' ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-line bg-card p-5">
              <div className="mb-3 font-medium">Русский · Telegram</div>
              <TemplateEditor
                value={draft.bodyRu}
                onChange={(bodyRu) => setDraft({ ...draft, bodyRu })}
              />
            </section>
            <section className="rounded-2xl border border-line bg-card p-5">
              <div className="mb-3 font-medium">O‘zbekcha · Telegram</div>
              <TemplateEditor
                value={draft.bodyUz}
                required={false}
                onChange={(bodyUz) => setDraft({ ...draft, bodyUz })}
              />
            </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-line bg-card p-5">
              <div className="mb-1 font-medium">Русский · SMS</div>
              <p className="mb-3 text-xs text-muted">
                {metaRu.unlimited
                  ? `${metaRu.chars} символов, без обрезки`
                  : `${metaRu.chars} / ${metaRu.limit}${
                      metaRu.over ? ' — слишком длинно' : ` · осталось ${metaRu.remaining}`
                    }`}
              </p>
              <TemplateEditor
                sms
                chips={welcomeDraft ? WELCOME_CHIPS : undefined}
                previewVars={{ link: previewLink }}
                smsLimit={editorLimit}
                toLatin={smsToLatin}
                lang="ru"
                value={draft.smsRu || ''}
                required={false}
                onChange={(smsRu) => setDraft({ ...draft, smsRu })}
              />
            </section>
            <section className="rounded-2xl border border-line bg-card p-5">
              <div className="mb-1 font-medium">O‘zbekcha · SMS</div>
              <p className="mb-3 text-xs text-muted">
                {metaUz.unlimited
                  ? `${metaUz.chars} символов, без обрезки`
                  : `${metaUz.chars} / ${metaUz.limit}${
                      metaUz.over ? ' — слишком длинно' : ` · осталось ${metaUz.remaining}`
                    }`}
              </p>
              <TemplateEditor
                sms
                chips={welcomeDraft ? WELCOME_CHIPS : undefined}
                previewVars={{ link: previewLink }}
                smsLimit={editorLimit}
                toLatin={smsToLatin}
                lang="uz"
                value={draft.smsUz || ''}
                required={false}
                onChange={(smsUz) => setDraft({ ...draft, smsUz })}
              />
            </section>
          </div>
        )}
      </form>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Шаблоны</h1>
          <p className="mt-1 text-sm text-muted">
            Салон выбирает шаблон. Приветствие продукта уходит один раз на номер со счёта Optika.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void addTemplate()}
          disabled={pending}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          + Шаблон
        </button>
      </div>

      <form onSubmit={saveProductSms} className="rounded-2xl border border-line bg-card p-5">
        <div className="font-medium">Общий счёт SMS</div>
        <p className="mt-1 text-sm text-muted">
          Свободно {product?.balance ?? 0} SMS, у салонов {product?.inBowls ?? 0}.
          Приветствие списывается отсюда. Салонам выдавайте на странице{' '}
          <Link to="/platform/sms" className="text-ink underline">
            SMS
          </Link>
          .
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Ссылка на бота</span>
            <input
              value={botLink}
              onChange={(e) => setBotLink(e.target.value)}
              placeholder="https://t.me/myoptika_bot"
              className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Лимит символов в SMS</span>
            <input
              type="number"
              min={MIN_SMS_CHAR_LIMIT}
              max={MAX_SMS_CHAR_LIMIT}
              value={smsCharLimit || ''}
              onChange={(e) => setSmsCharLimit(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              {smsToLatin
                ? 'После транслита одно SMS у оператора — 160 символов. Диапазон вашего лимита '
                : 'Кириллица. 70 — одно SMS у оператора. Диапазон '}
              {MIN_SMS_CHAR_LIMIT}–{MAX_SMS_CHAR_LIMIT}.
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-line px-3 py-3 md:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={smsToLatin}
              onChange={(e) => setSmsToLatin(e.target.checked)}
            />
            <span>
              <span className="block text-sm">SMS латиницей</span>
              <span className="mt-0.5 block text-xs text-muted">
                Если в тексте кириллица — перед отправкой переведём в латиницу. Telegram без изменений.
                Салон по-прежнему пишет по-русски и по-узбекски.
              </span>
            </span>
          </label>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm text-muted">Как салоны отправляют SMS</legend>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-xl border border-line px-3 py-3">
                <input
                  type="radio"
                  className="mt-1"
                  name="smsVia"
                  checked={!smsViaDevice}
                  onChange={() => setSmsViaDevice(false)}
                />
                <span>
                  <span className="block text-sm">Через провайдера</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Уходит само, списывается с баланса SMS.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-line px-3 py-3">
                <input
                  type="radio"
                  className="mt-1"
                  name="smsVia"
                  checked={smsViaDevice}
                  onChange={() => setSmsViaDevice(true)}
                />
                <span>
                  <span className="block text-sm">С телефона салона</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    При «Готов» откроется готовое SMS целиком, без обрезки. Сотрудник нажимает
                    Отправить. Баланс не списывается. Telegram как раньше.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-muted">Пополнить / списать</span>
            <input
              inputMode="numeric"
              value={smsDelta}
              onChange={(e) => setSmsDelta(e.target.value)}
              placeholder="+100 или -10"
              className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Сохранить счёт
        </button>
      </form>

      {welcome && (
        <article className="rounded-2xl border border-ink/20 bg-paper p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-brass-dark">Общий счёт · один раз</div>
              <div className="mt-1 font-medium">{welcome.name}</div>
              {welcome.hint ? <div className="mt-0.5 text-xs text-muted">{welcome.hint}</div> : null}
            </div>
            <button type="button" className="text-sm text-ink hover:underline" onClick={() => open(welcome)}>
              Править
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
            {prepareSms(
              renderTemplate(welcome.smsRu || welcome.bodyRu, { ...SAMPLE_VARS, link: previewLink }),
              smsCharLimit,
              { toLatin: smsToLatin, keepSuffix: previewLink },
            )}
          </pre>
        </article>
      )}

      <div className="grid gap-3">
        {salonItems.map((item) => {
          const tg = renderTemplate(item.bodyRu, SAMPLE_VARS)
          const sms = renderTemplate(item.smsRu || item.bodyRu, SAMPLE_VARS)
          const meta = smsMeta(sms, smsViaDevice ? null : smsCharLimit, smsToLatin)
          return (
            <article key={item.id} className="rounded-2xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.hint ? <div className="mt-0.5 text-xs text-muted">{item.hint}</div> : null}
                </div>
                <div className="flex gap-3 text-sm">
                  <button type="button" className="text-ink hover:underline" onClick={() => open(item)}>
                    Править
                  </button>
                  <button
                    type="button"
                    className="text-muted hover:underline"
                    onClick={() => void remove(item.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Telegram</div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
                    {tg}
                  </pre>
                </div>
                <div>
                  <div className={`mb-1 text-[11px] uppercase tracking-wide ${meta.over ? 'text-red-600' : 'text-muted'}`}>
                    SMS · {meta.chars}
                    {meta.unlimited ? ' · без обрезки' : ` / ${meta.limit}`}
                    {smsToLatin ? ' · латиница' : ''}
                    {meta.over ? ' · длиннее лимита' : ''}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
                    {meta.text}
                  </pre>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
