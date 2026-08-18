import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import { useAuth } from '../AuthContext'
import { formatSum, featuresOf, STATUS_LABEL, type OrderStatus } from '../types'

type Report = {
  features: { statsLevel: string }
  basic: {
    from: string
    to: string
    orders: number
    revenue: number
    newClients: number
    avgCheck: number
    byStatus: Record<string, number>
  }
  extended?: {
    avgCheck: number
    pickedUp: number
    cancelled: number
    conversion: number
    cancelRate: number
    repeatClients: number
    avgPickupHours: number | null
    byKind: Record<string, number>
    byWeekday: number[]
    notifications: Record<string, number>
    topItems: { name: string; qty: number }[]
    topLenses?: { name: string; qty: number }[]
    topFrames?: { name: string; qty: number }[]
    days: { day: string; orders: number; revenue: number }[]
    previous: {
      from: string
      to: string
      orders: number
      revenue: number
      newClients: number
      avgCheck: number
    }
  }
  network?: {
    salons: {
      id: string
      name: string
      orders: number
      revenue: number
      pickedUp: number
      cancelled: number
    }[]
  }
  focusId?: string | null
}

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const FUNNEL: OrderStatus[] = ['new', 'in_progress', 'ready', 'picked_up']
const STATUS_TONE: Record<string, string> = {
  new: 'bg-brass',
  in_progress: 'bg-ink-soft',
  ready: 'bg-ink',
  picked_up: 'bg-ink/55',
  cancelled: 'bg-muted/35',
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rangeOf(key: string): [string, string] {
  const now = new Date()
  if (key === '7') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return [ymd(from), ymd(now)]
  }
  if (key === 'prev') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return [ymd(from), ymd(to)]
  }
  if (key === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) * 3
    return [ymd(new Date(now.getFullYear(), q, 1)), ymd(now)]
  }
  return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)]
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function delta(now: number, prev: number) {
  if (!prev && !now) return null
  if (!prev) return { pct: 100, up: now >= 0, label: 'новые данные' }
  const pct = Math.round(((now - prev) / prev) * 100)
  return { pct: Math.abs(pct), up: pct >= 0, label: `${pct > 0 ? '+' : ''}${pct}%` }
}

function insights(data: Report) {
  const ext = data.extended
  if (!ext) return []
  const out: string[] = []
  const prev = ext.previous
  const revPct = prev.revenue
    ? Math.round(((data.basic.revenue - prev.revenue) / prev.revenue) * 100)
    : null
  if (revPct != null && Math.abs(revPct) >= 5) {
    out.push(
      revPct > 0
        ? `Выручка выросла на ${revPct}% к прошлому периоду.`
        : `Выручка ниже прошлого периода на ${Math.abs(revPct)}%.`,
    )
  }
  if (data.basic.orders >= 8 && ext.cancelRate >= 15) {
    out.push(`Отмены ${ext.cancelRate}% — стоит посмотреть, где клиенты срываются.`)
  }
  if (ext.conversion >= 70) {
    out.push(`Выдано ${ext.conversion}% заказов — конверсия сильная.`)
  } else if (data.basic.orders >= 8 && ext.conversion < 40) {
    out.push(`Выдано только ${ext.conversion}% — много заказов ещё в работе или зависло.`)
  }
  if (ext.avgPickupHours != null && ext.avgPickupHours >= 72) {
    out.push(`До выдачи в среднем ${Math.round(ext.avgPickupHours)} ч — клиенты ждут дольше трёх дней.`)
  }
  if (ext.repeatClients && data.basic.orders >= 8) {
    const share = Math.round((ext.repeatClients / Math.max(1, data.basic.newClients + ext.repeatClients)) * 100)
    if (share >= 35) out.push(`Повторных клиентов ${ext.repeatClients} — база уже возвращается.`)
  }
  const wd = ext.byWeekday
  if (wd?.length === 7 && data.basic.orders >= 10) {
    const best = wd.indexOf(Math.max(...wd))
    if (wd[best] > 0) out.push(`Пик заказов — ${WEEKDAYS[best]}.`)
  }
  return out.slice(0, 3)
}

function csvCell(value: unknown) {
  const s = value == null ? '' : String(value)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadReport(data: Report) {
  const rows: unknown[][] = [
    ['Показатель', 'Значение'],
    ['Период с', fmtDay(data.basic.from)],
    ['Период по', fmtDay(data.basic.to)],
    ['Заказы', data.basic.orders],
    ['Выручка, сум', data.basic.revenue],
    ['Новые клиенты', data.basic.newClients],
    ['Средний чек, сум', data.basic.avgCheck],
  ]
  for (const [key, label] of Object.entries(STATUS_LABEL)) {
    rows.push([label, data.basic.byStatus[key] || 0])
  }
  if (data.extended) {
    rows.push(['Выдано', data.extended.pickedUp])
    rows.push(['Отменено', data.extended.cancelled])
    rows.push(['Конверсия, %', data.extended.conversion])
    rows.push(['Повторные клиенты', data.extended.repeatClients])
    rows.push(['Telegram', data.extended.notifications.telegram || 0])
    rows.push(['SMS', data.extended.notifications.sms || 0])
    rows.push([])
    rows.push(['Товар', 'Кол-во'])
    for (const item of data.extended.topItems) rows.push([item.name, item.qty])
  }
  if (data.network) {
    rows.push([])
    rows.push(['Филиал', 'Заказы', 'Выручка', 'Выдано', 'Отменено'])
    for (const shop of data.network.salons) {
      rows.push([shop.name, shop.orders, shop.revenue, shop.pickedUp, shop.cancelled])
    }
  }
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `optika-report-${ymd(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function ReportsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const features = featuresOf(user)
  const extended = features.statsLevel !== 'basic'
  const [from, setFrom] = useState(() => rangeOf('month')[0])
  const [to, setTo] = useState(() => rangeOf('month')[1])
  const [salonId, setSalonId] = useState('')
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(nextFrom = from, nextTo = to, nextSalon = salonId) {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo })
    if (nextSalon) params.set('opticsId', nextSalon)
    setLoading(true)
    try {
      setData(await api<Report>(`/reports?${params}`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err: Error) => {
      setLoading(false)
      toast(err.message, 'err')
    })
  }, [])

  const notes = useMemo(() => (data ? insights(data) : []), [data])
  const presets = extended
    ? [
        ['7', '7 дней'],
        ['month', 'Месяц'],
        ['prev', 'Прошлый месяц'],
        ['quarter', 'Квартал'],
      ]
    : [
        ['7', '7 дней'],
        ['month', 'Месяц'],
      ]

  function applyPreset(key: string) {
    const [nextFrom, nextTo] = rangeOf(key)
    setFrom(nextFrom)
    setTo(nextTo)
    load(nextFrom, nextTo).catch((err: Error) => toast(err.message, 'err'))
  }

  if (!data && loading) return <p className="text-muted">Загрузка…</p>
  if (!data) return <p className="text-muted">Не удалось загрузить отчёт</p>

  const { basic } = data
  const prev = data.extended?.previous

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Отчёты</h1>
          <p className="mt-1 text-sm text-muted">
            {fmtDay(basic.from)} — {fmtDay(basic.to)}
            {features.statsLevel === 'network'
              ? ' · сводка по сети'
              : features.statsLevel === 'extended'
                ? ' · расширенная статистика салона'
                : ' · базовая статистика'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {features.canExport && (
            <button
              type="button"
              onClick={() => downloadReport(data)}
              className="rounded-xl border border-line px-4 py-2 text-sm"
            >
              CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-line px-4 py-2 text-sm"
          >
            Печать
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {presets.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink/30"
          >
            {label}
          </button>
        ))}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            load().catch((err: Error) => toast(err.message, 'err'))
          }}
        >
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
          {data.network && (
            <select
              value={salonId}
              onChange={(e) => {
                const next = e.target.value
                setSalonId(next)
                load(from, to, next).catch((err: Error) => toast(err.message, 'err'))
              }}
              className="rounded-xl border border-line px-3 py-2 text-sm"
            >
              <option value="">Все филиалы</option>
              {data.network.salons.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm text-white">
            {loading ? 'Считаем…' : 'Показать'}
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
        <Stat label="Заказы" value={String(basic.orders)} hint={prev ? delta(basic.orders, prev.orders) : null} />
        <Stat label="Выручка" value={formatSum(basic.revenue)} hint={prev ? delta(basic.revenue, prev.revenue) : null} />
        <Stat
          label="Новые клиенты"
          value={String(basic.newClients)}
          hint={prev ? delta(basic.newClients, prev.newClients) : null}
        />
        <Stat
          label="Средний чек"
          value={formatSum(basic.avgCheck)}
          hint={prev ? delta(basic.avgCheck, prev.avgCheck) : null}
        />
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 text-sm text-muted">Смесь статусов</div>
        <StatusMix byStatus={basic.byStatus} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2 md:block">
              <span className="text-muted">{label}</span>
              <span className="md:mt-0.5 md:block">{basic.byStatus[key] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      {data.extended ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Конверсия в выдачу" value={`${data.extended.conversion}%`} />
            <Stat label="Отмены" value={`${data.extended.cancelRate}%`} />
            <Stat label="Повторные клиенты" value={String(data.extended.repeatClients)} />
            <Stat
              label="До выдачи"
              value={data.extended.avgPickupHours != null ? `${data.extended.avgPickupHours} ч` : '—'}
            />
          </section>

          <section className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-3 text-sm text-muted">Воронка заказов</div>
            <Funnel byStatus={basic.byStatus} total={basic.orders} />
          </section>

          <section className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <div className="text-sm text-muted">Выручка по дням</div>
              <div className="text-xs text-muted">площадь — сумма, высота точек — динамика</div>
            </div>
            {basic.orders === 0 ? (
              <p className="py-10 text-center text-sm text-muted">За этот период заказов нет</p>
            ) : (
              <RevenueChart days={data.extended.days} />
            )}
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            {(data.extended.byKind.catalog || 0) > 0 &&
              (data.extended.byKind.rx || 0) > 0 && (
              <section className="rounded-2xl border border-line bg-card p-4">
                <div className="mb-3 text-sm text-muted">Каталог и рецепт</div>
                <ShareBars
                  items={[
                    { label: 'Каталог', value: data.extended.byKind.catalog || 0 },
                    { label: 'Рецепт', value: data.extended.byKind.rx || 0 },
                  ]}
                />
              </section>
            )}
            <section className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-3 text-sm text-muted">Дни недели</div>
              <WeekdayBars values={data.extended.byWeekday} />
            </section>
            {data.extended.topItems.length > 0 && (
              <TopList title="Топ позиций" items={data.extended.topItems} />
            )}
            {(data.extended.topLenses ?? []).length > 0 && (
              <TopList title="Топ линз" items={data.extended.topLenses ?? []} />
            )}
            {(data.extended.topFrames ?? []).length > 0 && (
              <TopList title="Топ оправ" items={data.extended.topFrames ?? []} />
            )}
            {data.extended.topItems.length === 0 &&
              (data.extended.topLenses ?? []).length === 0 &&
              (data.extended.topFrames ?? []).length === 0 && (
                <section className="rounded-2xl border border-line bg-card p-4">
                  <div className="mb-3 text-sm text-muted">Топ позиций</div>
                  <p className="text-sm text-muted">Пока нет позиций в заказах</p>
                </section>
              )}
            <section className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-3 text-sm text-muted">Уведомления</div>
              <ShareBars
                items={[
                  { label: 'Telegram', value: data.extended.notifications.telegram || 0 },
                  { label: 'SMS', value: data.extended.notifications.sms || 0 },
                ]}
              />
              <p className="mt-3 text-xs text-muted">
                SMS считаются, Telegram без лимита. Сравнение с выдачей: {data.extended.pickedUp} выдано.
              </p>
            </section>
          </div>
        </>
      ) : (
        <Locked text="Сравнение с прошлым периодом, воронка, график и топ позиций — в тарифе Business" />
      )}

      {data.network ? (
        <section className="rounded-2xl border border-line bg-card p-4">
          <div className="mb-3 text-sm text-muted">Филиалы сети</div>
          <NetworkTable salons={data.network.salons} />
        </section>
      ) : features.statsLevel !== 'network' ? (
        <Locked text="Сводка по всей сети и сравнение филиалов — в тарифе Enterprise" />
      ) : (
        <p className="text-sm text-muted">Сводку по сети видит владелец организации.</p>
      )}
    </div>
  )
}

function TopList({
  title,
  items,
}: {
  title: string
  items: { name: string; qty: number }[]
}) {
  const max = items[0]?.qty || 1
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 text-sm text-muted">{title}</div>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.name} className="text-sm">
            <div className="flex justify-between gap-3">
              <span>
                {i + 1}. {item.name}
              </span>
              <span className="text-muted">{item.qty}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${Math.max(8, (item.qty / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: { pct: number; up: boolean; label: string } | null
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
      {hint && (
        <div className={`mt-1 text-xs ${hint.up ? 'text-ink-soft' : 'text-muted'}`}>
          {hint.label} к прошлому периоду
        </div>
      )}
    </div>
  )
}

function StatusMix({ byStatus }: { byStatus: Record<string, number> }) {
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0)
  if (!total) {
    return <div className="h-3 rounded-full bg-line" />
  }
  return (
    <div className="flex h-3 overflow-hidden rounded-full">
      {Object.entries(STATUS_LABEL).map(([key]) => {
        const n = byStatus[key] || 0
        if (!n) return null
        return (
          <div
            key={key}
            className={STATUS_TONE[key] || 'bg-ink'}
            style={{ width: `${(n / total) * 100}%` }}
            title={`${STATUS_LABEL[key as OrderStatus]}: ${n}`}
          />
        )
      })}
    </div>
  )
}

function Funnel({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const max = Math.max(1, total, ...FUNNEL.map((key) => byStatus[key] || 0))
  return (
    <div className="space-y-2">
      {FUNNEL.map((key) => {
        const n = byStatus[key] || 0
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <div className="w-24 shrink-0 text-muted">{STATUS_LABEL[key]}</div>
            <div className="h-7 min-w-0 flex-1 rounded-lg bg-line/70">
              <div
                className="flex h-full items-center rounded-lg bg-ink px-2 text-xs text-white"
                style={{ width: `${Math.max(n ? 12 : 0, (n / max) * 100)}%` }}
              >
                {n > 0 ? n : ''}
              </div>
            </div>
            <div className="w-10 text-right text-muted">{total ? Math.round((n / total) * 100) : 0}%</div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 text-sm">
        <div className="w-24 shrink-0 text-muted">{STATUS_LABEL.cancelled}</div>
        <div className="text-muted">{byStatus.cancelled || 0}</div>
      </div>
    </div>
  )
}

function RevenueChart({ days }: { days: { day: string; orders: number; revenue: number }[] }) {
  const w = 720
  const h = 200
  const padL = 4
  const padR = 4
  const padT = 16
  const padB = 28
  const maxR = Math.max(1, ...days.map((d) => d.revenue))
  const n = Math.max(1, days.length - 1)
  const pts = days.map((d, i) => {
    const x = padL + (i / n) * (w - padL - padR)
    const y = padT + (1 - d.revenue / maxR) * (h - padT - padB)
    return { x, y, ...d }
  })
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const last = pts[pts.length - 1]
  const area = `${padL},${h - padB} ${line} ${last ? last.x : padL},${h - padB}`
  const ticks = [pts[0], pts[Math.floor(pts.length / 2)], last].filter(Boolean)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full text-ink" role="img" aria-label="Выручка по дням">
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      {ticks.map((p) =>
        p ? (
          <text key={p.day} x={p.x} y={h - 8} fontSize="11" fill="currentColor" opacity="0.55" textAnchor="middle">
            {p.day.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

function ShareBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="text-sm">
          <div className="flex justify-between">
            <span>{item.label}</span>
            <span className="text-muted">{item.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function WeekdayBars({ values }: { values: number[] }) {
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: WEEKDAYS[i], value: values[i] || 0 }))
  const max = Math.max(1, ...ordered.map((d) => d.value))
  return (
    <div className="flex h-28 items-end gap-2">
      {ordered.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-20 w-full items-end">
            <div
              className="w-full rounded-t bg-ink/80"
              style={{ height: `${Math.max(d.value ? 8 : 2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function NetworkTable({
  salons,
}: {
  salons: { id: string; name: string; orders: number; revenue: number; pickedUp: number; cancelled: number }[]
}) {
  const totalRev = salons.reduce((sum, shop) => sum + shop.revenue, 0) || 1
  return (
    <div className="space-y-3">
      {salons.map((shop) => (
        <div key={shop.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>{shop.name}</span>
            <span className="text-muted">
              {shop.orders} зак. · {formatSum(shop.revenue)} · выдано {shop.pickedUp}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brass"
              style={{ width: `${Math.max(shop.revenue ? 4 : 0, (shop.revenue / totalRev) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Locked({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">{text}</div>
  )
}
