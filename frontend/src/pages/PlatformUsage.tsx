import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, downloadCsv } from '../api'
import { useToast } from '../Toast'
import { formatSum, STATUS_LABEL } from '../types'

type NamedCount = { name: string; count: number }

type CreateRow = {
  at: string
  salon: string
  kind: 'rx' | 'catalog'
  ms: number
  newClient: boolean
  deposit: boolean
  chip: boolean
  lens: boolean
  frame: boolean
  items: number
}

type UsageSnapshot = {
  from: string
  to: string
  ux: {
    sessions: number
    pwa: number
    opens: number
    submits: number
    holds: number
    closes: number
    abandon: number
    pickerSelect: number
    pickerCreate: number
    chip: number
    newClientUi: number
    depositUi: number
    screens: NamedCount[]
    errors: NamedCount[]
    time: {
      all: number | null
      avg: number | null
      min: number | null
      max: number | null
      p90: number | null
      count: number
      rx: number | null
      catalog: number | null
      goods: number | null
      client: number | null
    }
    creates: CreateRow[]
  }
  sales: {
    orders: number
    revenue: number
    avgCheck: number
    byKind: { catalog: number; rx: number }
    byStatus: Record<string, number>
    withDeposit: number
    newOnOrder: number
    returning: number
    avgPickupHours: number | null
    products: NamedCount[]
    lenses: NamedCount[]
    frames: NamedCount[]
    salons: NamedCount[]
  }
  notify: Record<string, number>
}

const ERROR_LABEL: Record<string, string> = {
  phone: 'телефон',
  name: 'ФИО',
  empty: 'пустое поле',
  client: 'клиент не выбран',
  deposit: 'залог больше итога',
  amount: 'нет суммы',
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtMs(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} мс`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} с`
  const m = Math.floor(s / 60)
  const rest = s % 60
  return rest ? `${m} мин ${rest} с` : `${m} мин`
}

function pct(part: number, total: number) {
  if (!total) return '—'
  return `${Math.round((part / total) * 100)}%`
}

function insights(data: UsageSnapshot) {
  const out: string[] = []
  const { ux, sales } = data
  if (ux.opens >= 5) {
    const done = ux.submits / ux.opens
    if (done < 0.45) {
      out.push(`До конца доходят ${pct(ux.submits, ux.opens)} открытых заказов — форма, скорее всего, где-то тормозит.`)
    } else if (done >= 0.75) {
      out.push(`Заказы доводят до сохранения в ${pct(ux.submits, ux.opens)} случаев — поток ровный.`)
    }
  }
  if (ux.time.avg != null && ux.time.count >= 1) {
    out.unshift(
      `Один заказ: среднее ${fmtMs(ux.time.avg)}, лучшее ${fmtMs(ux.time.min)}, самое долгое ${fmtMs(ux.time.max)}.`,
    )
  }
  if (ux.time.rx != null && ux.time.catalog != null && ux.time.rx > ux.time.catalog * 1.6) {
    out.push(`Рецепт занимает ${fmtMs(ux.time.rx)}, каталог ${fmtMs(ux.time.catalog)} — RX форма заметно дольше.`)
  }
  if (ux.time.goods != null && ux.time.client != null && ux.time.client > ux.time.goods) {
    out.push(`На клиенте сидят дольше, чем на товарах (${fmtMs(ux.time.client)} vs ${fmtMs(ux.time.goods)}).`)
  }
  if (ux.pickerCreate + ux.pickerSelect >= 8 && ux.pickerCreate > ux.pickerSelect) {
    out.push('Новых клиентов заводят чаще, чем выбирают из базы — либо база пустая, либо поиск не попадает.')
  }
  if (ux.submits >= 5 && ux.chip / ux.submits >= 0.4) {
    out.push(`Подсказки линз/оправ берут в ${pct(ux.chip, ux.submits)} заказов — чипы работают.`)
  }
  const tg = (data.notify['telegram:sent'] || 0)
  const sms = (data.notify['sms:sent'] || 0) + (data.notify['sms:mocked'] || 0)
  if (tg + sms >= 5) {
    out.push(`Сообщения: Telegram ${tg}, SMS ${sms}.`)
  }
  if (sales.orders >= 5 && sales.byKind.rx > sales.byKind.catalog * 2) {
    out.push('Большинство продаж — рецепт. Каталог пока вторичный.')
  }
  return out.slice(0, 5)
}

export default function PlatformUsage() {
  const toast = useToast()
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 13)
    return ymd(d)
  })
  const [to, setTo] = useState(() => ymd(new Date()))
  const [data, setData] = useState<UsageSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(nextFrom = from, nextTo = to) {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from: nextFrom, to: nextTo })
      setData(await api<UsageSnapshot>(`/platform/usage?${q}`))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  function onRange(e: FormEvent) {
    e.preventDefault()
    load().catch(() => {})
  }

  const notes = useMemo(() => (data ? insights(data) : []), [data])

  if (!data) {
    return <div className="text-muted">{loading ? 'Считаем…' : 'Нет данных'}</div>
  }

  const { ux, sales } = data
  const notifyTg = data.notify['telegram:sent'] || 0
  const notifySms = (data.notify['sms:sent'] || 0) + (data.notify['sms:mocked'] || 0)
  const notifyFail =
    (data.notify['telegram:failed'] || 0) + (data.notify['sms:failed'] || 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Тестовый период</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Как салоны пользуются Optika: где застревают, сколько времени уходит на заказ,
            что продаётся. Без ФИО, телефонов и цифр рецепта.
          </p>
        </div>
        <form onSubmit={onRange} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-line px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-line px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm text-white">
            {loading ? 'Считаем…' : 'Показать'}
          </button>
          <button
            type="button"
            onClick={() => {
              const q = new URLSearchParams({ from, to })
              downloadCsv(`/platform/usage.csv?${q}`, `optika-test-${from}-${to}.csv`).catch(
                (err: Error) => toast(err.message, 'err'),
              )
            }}
            className="rounded-xl border border-line px-4 py-2 text-sm"
          >
            CSV
          </button>
        </form>
      </div>

      {notes.length > 0 && (
        <section className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          {notes.map((note) => (
            <p key={note} className="text-ink/80">
              {note}
            </p>
          ))}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Сессии" value={String(ux.sessions)} hint={ux.pwa ? `${ux.pwa} с экрана «как приложение»` : 'браузер'} />
        <Stat label="Открыли заказ" value={String(ux.opens)} />
        <Stat label="Сохранили" value={String(ux.submits)} hint={pct(ux.submits, ux.opens)} />
        <Stat label="Бросили" value={String(ux.abandon)} hint={`отложили ${ux.holds} · закрыли ${ux.closes}`} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Среднее время"
          value={fmtMs(ux.time.avg)}
          hint={ux.time.count ? `по ${ux.time.count} заказ.` : 'пока нет замеров'}
        />
        <Stat label="Лучшее" value={fmtMs(ux.time.min)} hint="самый быстрый заказ" />
        <Stat label="Самое долгое" value={fmtMs(ux.time.max)} hint="самый медленный заказ" />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Рецепт" value={fmtMs(ux.time.rx)} />
        <Stat label="Каталог" value={fmtMs(ux.time.catalog)} />
        <Stat label="Шаг: товары / рецепт" value={fmtMs(ux.time.goods)} />
        <Stat label="Шаг: клиент" value={fmtMs(ux.time.client)} />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-xl">Как оформляют</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Row label="Взяли из базы" value={ux.pickerSelect} />
            <Row label="Создали нового" value={ux.pickerCreate} />
            <Row label="Новый клиент при сохранении" value={ux.newClientUi} />
            <Row label="С залогом" value={ux.depositUi} />
            <Row label="Чип линзы/оправы" value={ux.chip} />
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-xl">Где спотыкаются</h2>
          {ux.errors.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Пока нет ошибок валидации.</p>
          ) : (
            <Bars
              items={ux.errors.map((row) => ({
                name: ERROR_LABEL[row.name] || row.name,
                count: row.count,
              }))}
            />
          )}
        </section>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Заказы" value={String(sales.orders)} />
        <Stat label="Выручка" value={formatSum(sales.revenue)} />
        <Stat label="Средний чек" value={formatSum(sales.avgCheck)} />
        <Stat
          label="До выдачи"
          value={sales.avgPickupHours == null ? '—' : `${sales.avgPickupHours} ч`}
        />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-xl">Продажи</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Row label="Рецепт" value={sales.byKind.rx} />
            <Row label="Каталог" value={sales.byKind.catalog} />
            <Row label="С залогом" value={sales.withDeposit} />
            <Row label="Новые клиенты" value={sales.newOnOrder} />
            <Row label="Повторные" value={sales.returning} />
          </ul>
          <div className="mt-4 space-y-1 text-sm">
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <Row key={key} label={label} value={sales.byStatus[key] || 0} />
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-xl">Сообщения</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Row label="Telegram" value={notifyTg} />
            <Row label="SMS" value={notifySms} />
            <Row label="Не дошли" value={notifyFail} />
          </ul>
          <p className="mt-3 text-xs text-muted">Telegram бесплатный, SMS списывается с пакета.</p>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Rank title="Товары" items={sales.products} />
        <Rank title="Линзы" items={sales.lenses} />
        <Rank title="Оправы" items={sales.frames} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Rank title="Салоны по заказам" items={sales.salons} />
        <Rank title="Экраны" items={ux.screens} />
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-xl">Время каждого заказа</h2>
        <p className="mt-1 text-sm text-muted">
          От открытия формы до «Создать заказ». Полный список — в CSV.
        </p>
        {ux.creates.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Пока нет сохранённых заказов с замером.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-lg text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-normal">Когда</th>
                  <th className="py-1.5 pr-3 font-normal">Салон</th>
                  <th className="py-1.5 pr-3 font-normal">Тип</th>
                  <th className="py-1.5 font-normal">Время</th>
                </tr>
              </thead>
              <tbody>
                {ux.creates.slice(-20).reverse().map((row) => (
                  <tr key={`${row.at}-${row.ms}`} className="border-t border-line">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(row.at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 pr-3 truncate">{row.salon || '—'}</td>
                    <td className="py-2 pr-3">{row.kind === 'rx' ? 'рецепт' : 'каталог'}</td>
                    <td className="py-2 font-medium">{fmtMs(row.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  )
}

function Rank({ title, items }: { title: string; items: NamedCount[] }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-xl">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Пока пусто</p>
      ) : (
        <Bars items={items} />
      )}
    </section>
  )
}

function Bars({ items }: { items: NamedCount[] }) {
  const max = Math.max(...items.map((item) => item.count), 1)
  return (
    <ol className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.name}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{item.name}</span>
            <span className="shrink-0 text-muted">{item.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
