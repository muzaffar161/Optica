import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import TemplateEditor from '../components/TemplateEditor'
import TemplatePicker from '../components/TemplatePicker'
import { matchTemplateKey } from '../template'
import { formatDate, formatSum, type PlatformOptics, type PlatformStats } from '../types'

type PlanOption = { id: string; name: string; price: number; isActive: boolean }

export default function PlatformHome() {
  const toast = useToast()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [shops, setShops] = useState<PlatformOptics[]>([])
  const [defaultTemplate, setDefaultTemplate] = useState('')
  const [defaultTemplateKey, setDefaultTemplateKey] = useState('compact')
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor, setResetFor] = useState<PlatformOptics | null>(null)
  const [editFor, setEditFor] = useState<PlatformOptics | null>(null)
  const [editName, setEditName] = useState('')
  const [editTemplate, setEditTemplate] = useState('')
  const [editStaffLimit, setEditStaffLimit] = useState(5)
  const [editCatalog, setEditCatalog] = useState(true)
  const [editRx, setEditRx] = useState(false)
  const [createCatalog, setCreateCatalog] = useState(true)
  const [createRx, setCreateRx] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [createPlanId, setCreatePlanId] = useState('')
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [pending, setPending] = useState(false)

  async function load() {
    const [s, list, config, p] = await Promise.all([
      api<PlatformStats>('/platform/stats'),
      api<PlatformOptics[]>('/platform/optics'),
      api<{ defaultTemplate: string; defaultTemplateKey?: string }>('/platform/config'),
      api<PlanOption[]>('/platform/plans').catch(() => [] as PlanOption[]),
    ])
    setStats(s)
    setShops(list)
    setDefaultTemplate(config.defaultTemplate)
    setDefaultTemplateKey(config.defaultTemplateKey || matchTemplateKey(config.defaultTemplate))
    setPlans(p)
    if (!createPlanId) {
      const first = p.find((row) => row.isActive)
      if (first) setCreatePlanId(first.id)
    }
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  async function createShop(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await api('/platform/optics', {
        method: 'POST',
        body: JSON.stringify({
          name,
          username,
          password,
          catalogOrders: createCatalog,
          rxOrders: createRx,
          planId: createPlanId || undefined,
        }),
      })
      setCreateOpen(false)
      setName('')
      setUsername('')
      setPassword('')
      setCreateCatalog(true)
      setCreateRx(false)
      toast('Салон создан')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    if (!resetFor) return
    setPending(true)
    try {
      await api(`/platform/optics/${resetFor.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          password,
          ...(!resetFor.username ? { username } : {}),
        }),
      })
      setResetFor(null)
      setPassword('')
      setUsername('')
      toast('Пароль обновлён')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function saveDefaultTemplate(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const saved = await api<{ defaultTemplate: string; defaultTemplateKey?: string }>(
        '/platform/config',
        {
          method: 'PATCH',
          body: JSON.stringify({
            defaultTemplate,
            defaultTemplateKey: matchTemplateKey(defaultTemplate),
          }),
        },
      )
      setDefaultTemplate(saved.defaultTemplate)
      setDefaultTemplateKey(saved.defaultTemplateKey || matchTemplateKey(saved.defaultTemplate))
      toast('Общий шаблон сохранён')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function saveShop(e: FormEvent) {
    e.preventDefault()
    if (!editFor) return
    setPending(true)
    try {
      const body: {
        name: string
        template?: string
        templateKey?: string
        staffLimit: number
        catalogOrders: boolean
        rxOrders: boolean
      } = {
        name: editName,
        staffLimit: editStaffLimit,
        catalogOrders: editCatalog,
        rxOrders: editRx,
      }
      if (editTemplate !== (editFor.settings?.template ?? defaultTemplate)) {
        body.template = editTemplate
        body.templateKey = matchTemplateKey(editTemplate)
      }
      await api(`/platform/optics/${editFor.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setEditFor(null)
      toast('Салон обновлён')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function resetShopTemplate() {
    if (!editFor) return
    setPending(true)
    try {
      await api(`/platform/optics/${editFor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resetTemplate: true }),
      })
      setEditFor(null)
      toast('Вернули общий шаблон')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function toggleActive(shop: PlatformOptics) {
    try {
      await api(`/platform/optics/${shop.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !shop.active }),
      })
      toast(shop.active ? 'Салон отключён' : 'Салон включён')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Салоны</h1>
          <p className="mt-1 text-sm text-muted">
            Аккаунты оптик, клиенты, заказы и отправленные SMS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="hidden rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-soft md:inline-flex"
        >
          Открыть салон
        </button>
      </div>

      <form
        onSubmit={saveDefaultTemplate}
        className="mb-6 rounded-2xl border border-line bg-card p-5"
      >
        <div className="font-display text-xl">Шаблоны сообщений</div>
        <p className="mt-1 mb-3 text-sm text-muted">
          Выберите вид текста для всех салонов. Потом можно дописать свой или
          задать отдельный шаблон у конкретного салона.
        </p>
        <TemplatePicker
          value={defaultTemplate}
          selectedKey={defaultTemplateKey}
          onSelect={(key, body) => {
            setDefaultTemplateKey(key)
            setDefaultTemplate(body)
          }}
        />
        <div className="mt-4">
          <div className="mb-2 text-sm text-muted">Или напишите свой текст</div>
          <TemplateEditor value={defaultTemplate} onChange={(next) => {
            setDefaultTemplate(next)
            setDefaultTemplateKey(matchTemplateKey(next))
          }} />
        </div>
        <button
          type="submit"
          disabled={pending || !defaultTemplate.trim()}
          className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Сохраняем…' : 'Сохранить для всех'}
        </button>
      </form>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Салоны" value={stats.opticsCount} hint={`${stats.activeOptics} активных`} />
          <Stat label="Клиенты" value={stats.clientCount} />
          <Stat label="Заказы" value={stats.orderCount} />
          <Stat label="SMS" value={stats.smsCount} hint="включая заглушки" />
          <Stat label="Telegram" value={stats.telegramCount} hint="доставлено" />
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {shops.length === 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-16 text-center text-muted">
            Салонов пока нет — откройте первый аккаунт.
          </div>
        )}
        {shops.map((shop) => (
          <article key={shop.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{shop.name}</div>
                <div className="text-xs text-muted">{shop.username ?? 'нет логина'}</div>
              </div>
              {shop.active ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                  активен
                </span>
              ) : (
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                  отключён
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              <span>{shop._count.clients} кл.</span>
              <span>{shop._count.orders} зак.</span>
              <span>{shop.smsCount} SMS</span>
              <span>{shop.telegramCount} TG</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {shop.catalogOrders !== false && (
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">
                  каталог
                </span>
              )}
              {shop.rxOrders && (
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">
                  рецепт
                </span>
              )}
              {shop.settings?.templateCustom && (
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-brass-dark">
                  свой шаблон
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setEditFor(shop)
                  setEditName(shop.name)
                  setEditTemplate(shop.settings?.template || defaultTemplate)
                  setEditStaffLimit(shop.staffLimit ?? 5)
                  setEditCatalog(shop.catalogOrders !== false)
                  setEditRx(!!shop.rxOrders)
                }}
                className="text-ink hover:underline"
              >
                Настроить
              </button>
              <button
                type="button"
                onClick={() => {
                  setPassword('')
                  setUsername('')
                  setResetFor(shop)
                }}
                className="text-ink hover:underline"
              >
                Пароль
              </button>
              <button
                type="button"
                onClick={() => toggleActive(shop)}
                className="text-muted hover:underline"
              >
                {shop.active ? 'Отключить' : 'Включить'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Салон</th>
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Клиенты</th>
              <th className="px-4 py-3 font-medium">Заказы</th>
              <th className="px-4 py-3 font-medium">SMS</th>
              <th className="px-4 py-3 font-medium">Telegram</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted">
                  Салонов пока нет — откройте первый аккаунт.
                </td>
              </tr>
            )}
            {shops.map((shop) => (
              <tr key={shop.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{shop.name}</div>
                  <div className="text-xs text-muted">{formatDate(shop.createdAt)}</div>
                  {shop.settings?.templateCustom && (
                    <div className="mt-1 text-[11px] text-brass-dark">свой шаблон</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {shop.catalogOrders !== false && (
                      <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">
                        каталог
                      </span>
                    )}
                    {shop.rxOrders && (
                      <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">
                        рецепт
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{shop.username ?? '—'}</td>
                <td className="px-4 py-3">{shop._count.clients}</td>
                <td className="px-4 py-3">{shop._count.orders}</td>
                <td className="px-4 py-3">{shop.smsCount}</td>
                <td className="px-4 py-3">{shop.telegramCount}</td>
                <td className="px-4 py-3">
                  {shop.active ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                      активен
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                      отключён
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setEditFor(shop)
                      setEditName(shop.name)
                      setEditTemplate(shop.settings?.template || defaultTemplate)
                      setEditStaffLimit(shop.staffLimit ?? 5)
                      setEditCatalog(shop.catalogOrders !== false)
                      setEditRx(!!shop.rxOrders)
                    }}
                    className="mr-3 text-xs text-ink hover:underline"
                  >
                    Шаблон
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword('')
                      setUsername('')
                      setResetFor(shop)
                    }}
                    className="mr-3 text-xs text-ink hover:underline"
                  >
                    Сбросить пароль
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(shop)}
                    className="text-xs text-muted hover:underline"
                  >
                    {shop.active ? 'Отключить' : 'Включить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <Modal title="Новый салон" onClose={() => setCreateOpen(false)}>
          <form onSubmit={createShop} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название оптики</span>
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Логин</span>
              <input
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="optika_yunusabad"
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Пароль</span>
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Тариф организации</span>
              <select
                value={createPlanId}
                onChange={(e) => setCreatePlanId(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              >
                {plans.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatSum(p.price)}
                  </option>
                ))}
              </select>
            </label>
            <ModeToggles
              catalog={createCatalog}
              rx={createRx}
              onCatalog={setCreateCatalog}
              onRx={setCreateRx}
            />
            <button
              type="submit"
              disabled={pending || (!createCatalog && !createRx)}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Создаём…' : 'Создать аккаунт'}
            </button>
          </form>
        </Modal>
      )}

      {editFor && (
        <Modal title={editFor.name} onClose={() => setEditFor(null)} wide>
          <form onSubmit={saveShop} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название оптики</span>
              <input
                required
                minLength={2}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Сколько сотрудников можно добавить</span>
              <input
                required
                type="number"
                min={0}
                value={editStaffLimit}
                onChange={(e) => setEditStaffLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <ModeToggles
              catalog={editCatalog}
              rx={editRx}
              onCatalog={setEditCatalog}
              onRx={setEditRx}
            />
            <div>
              <span className="mb-2 block text-sm text-muted">
                {editFor.settings?.templateCustom
                  ? 'Свой шаблон этого салона'
                  : 'Сейчас общий шаблон — можно выбрать другой вид'}
              </span>
              <TemplatePicker
                value={editTemplate}
                selectedKey={matchTemplateKey(editTemplate)}
                previewVars={{
                  opticsName: editName,
                  address: editFor.settings?.address || '',
                  landmark: editFor.settings?.landmark || '',
                  hours: editFor.settings?.hours || '',
                  phone: editFor.settings?.phone || '',
                }}
                onSelect={(_key, body) => setEditTemplate(body)}
              />
              <div className="mt-3">
                <TemplateEditor
                  value={editTemplate}
                  onChange={setEditTemplate}
                  previewVars={{
                    opticsName: editName,
                    address: editFor.settings?.address || '',
                    landmark: editFor.settings?.landmark || '',
                    hours: editFor.settings?.hours || '',
                    phone: editFor.settings?.phone || '',
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending || (!editCatalog && !editRx)}
                className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? 'Сохраняем…' : 'Сохранить'}
              </button>
              {editFor.settings?.templateCustom && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => resetShopTemplate()}
                  className="rounded-xl border border-line px-4 py-2.5 text-sm"
                >
                  Вернуть общий
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}

      {resetFor && (
        <Modal title={`Пароль: ${resetFor.name}`} onClose={() => setResetFor(null)}>
          <form onSubmit={resetPassword} className="space-y-4">
            <p className="text-sm text-muted">
              {resetFor.username
                ? `Логин ${resetFor.username} останется прежним. Сообщите новый пароль салону.`
                : 'У салона ещё нет логина — задайте его вместе с паролем.'}
            </p>
            {!resetFor.username && (
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Логин</span>
                <input
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Новый пароль</span>
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Сохраняем…' : 'Сбросить пароль'}
            </button>
          </form>
        </Modal>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-2xl bg-ink py-3.5 text-sm font-medium text-white shadow-lg md:hidden"
      >
        Открыть салон
      </button>
    </div>
  )
}

function ModeToggles({
  catalog,
  rx,
  onCatalog,
  onRx,
}: {
  catalog: boolean
  rx: boolean
  onCatalog: (value: boolean) => void
  onRx: (value: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted">Какие заказы доступны салону</div>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-paper/60 px-3 py-3">
        <input
          type="checkbox"
          checked={catalog}
          onChange={(e) => onCatalog(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium">Каталог товаров</span>
          <span className="text-xs text-muted">
            Вкладка «Товары» и заказ с фото, как сейчас
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-paper/60 px-3 py-3">
        <input
          type="checkbox"
          checked={rx}
          onChange={(e) => onRx(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium">Заказ по рецепту</span>
          <span className="text-xs text-muted">
            OD / OS, линза, оправа и сумма — как бумажный бланк
          </span>
        </span>
      </label>
      {!catalog && !rx && (
        <p className="text-xs text-red-700">Нужно включить хотя бы один вариант</p>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display mt-1 text-3xl">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  )
}
