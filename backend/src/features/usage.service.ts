import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseRxJson } from '../common/rx';
import type { AuthUser } from '../common/auth-user';

export const USAGE_NAMES = [
  'session',
  'screen',
  'order_open',
  'order_step',
  'order_submit',
  'order_hold',
  'order_close',
  'picker_select',
  'picker_create',
  'notify',
  'error',
] as const;

export type UsageName = (typeof USAGE_NAMES)[number];

export type UsageInput = {
  name: string;
  path?: string;
  ms?: number | null;
  meta?: Record<string, string | number | boolean>;
};

const META_KEYS = new Set([
  'kind',
  'step',
  'newClient',
  'deposit',
  'chip',
  'blocks',
  'lens',
  'frame',
  'items',
  'note',
  'pwa',
  'w',
  'channel',
  'ok',
  'reason',
]);

function cleanMeta(raw?: Record<string, string | number | boolean>) {
  if (!raw) return '';
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!META_KEYS.has(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 40);
    else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.round(value);
    } else if (typeof value === 'boolean') out[key] = value;
  }
  const json = JSON.stringify(out);
  return json === '{}' ? '' : json.slice(0, 400);
}

function parseMeta(raw: string): Record<string, string | number | boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string | number | boolean>) : {};
  } catch {
    return {};
  }
}

function median(nums: number[]) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

function p90(nums: number[]) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(0.9 * (sorted.length - 1)));
  return sorted[idx];
}

function bump(map: Map<string, number>, key: string, n = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + n);
}

function top(map: Map<string, number>, take = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([name, count]) => ({ name, count }));
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('usage.track')
  async onTrack(
    payload: UsageInput & {
      user?: AuthUser;
      opticsId?: string | null;
      organizationId?: string | null;
    },
  ) {
    try {
      await this.write(payload.user, [payload], {
        opticsId: payload.opticsId,
        organizationId: payload.organizationId,
      });
    } catch (err) {
      this.logger.warn(err instanceof Error ? err.message : 'usage failed');
    }
  }

  async write(
    user: AuthUser | undefined,
    events: UsageInput[],
    ctx?: { opticsId?: string | null; organizationId?: string | null },
  ) {
    const rows = events
      .filter((event) => USAGE_NAMES.includes(event.name as UsageName))
      .slice(0, 40)
      .map((event) => ({
        name: event.name,
        opticsId: ctx?.opticsId ?? user?.opticsId ?? null,
        organizationId: ctx?.organizationId ?? user?.organizationId ?? null,
        userId: user?.sub ?? null,
        role: user?.role ?? '',
        path: (event.path || '').slice(0, 80),
        ms:
          typeof event.ms === 'number' && event.ms >= 0
            ? Math.min(86_400_000, Math.round(event.ms))
            : null,
        meta: cleanMeta(event.meta),
      }));
    if (!rows.length) return { ok: true, saved: 0 };
    await this.prisma.usageEvent.createMany({ data: rows });
    return { ok: true, saved: rows.length };
  }

  async snapshot(fromQ?: string, toQ?: string) {
    const to = endOfDay(parseDay(toQ) || new Date());
    const from = startOfDay(parseDay(fromQ) || daysAgo(to, 13));
    const where = { createdAt: { gte: from, lte: to } };

    const [events, orders, notifications, salons] = await Promise.all([
      this.prisma.usageEvent.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
          name: true,
          path: true,
          ms: true,
          meta: true,
          opticsId: true,
          createdAt: true,
        },
      }),
      this.prisma.order.findMany({
        where,
        select: {
          kind: true,
          status: true,
          amount: true,
          paidAmount: true,
          createdAt: true,
          updatedAt: true,
          clientId: true,
          opticsId: true,
          rxJson: true,
          items: { select: { name: true, qty: true } },
        },
      }),
      this.prisma.notification.groupBy({
        by: ['channel', 'status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.optics.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const salonName = new Map(salons.map((row) => [row.id, row.name]));
    const screens = new Map<string, number>();
    const stepMs: Record<string, number[]> = {};
    const submitMs: Record<string, number[]> = { rx: [], catalog: [] };
    const allMs: number[] = [];
    const creates: {
      at: string;
      salon: string;
      kind: 'rx' | 'catalog';
      ms: number;
      newClient: boolean;
      deposit: boolean;
      chip: boolean;
      lens: boolean;
      frame: boolean;
      items: number;
    }[] = [];
    let opens = 0;
    let submits = 0;
    let holds = 0;
    let sessions = 0;
    let pwa = 0;
    let pickerSelect = 0;
    let pickerCreate = 0;
    let chip = 0;
    let newClientUi = 0;
    let depositUi = 0;
    let closes = 0;
    const errors = new Map<string, number>();

    for (const row of events) {
      const meta = parseMeta(row.meta);
      if (row.name === 'session') {
        sessions += 1;
        if (meta.pwa) pwa += 1;
      }
      if (row.name === 'screen') bump(screens, row.path || '/');
      if (row.name === 'order_open') opens += 1;
      if (row.name === 'order_hold') holds += 1;
      if (row.name === 'order_close') closes += 1;
      if (row.name === 'error') bump(errors, String(meta.reason || 'other'));
      if (row.name === 'picker_select') pickerSelect += 1;
      if (row.name === 'picker_create') pickerCreate += 1;
      if (row.name === 'order_step' && typeof row.ms === 'number') {
        const step = String(meta.step || 'goods');
        (stepMs[step] ||= []).push(row.ms);
      }
      if (row.name === 'order_submit') {
        submits += 1;
        const kind = meta.kind === 'catalog' ? 'catalog' : 'rx';
        if (typeof row.ms === 'number') {
          submitMs[kind].push(row.ms);
          allMs.push(row.ms);
          if (creates.length < 2000) {
            creates.push({
              at: row.createdAt.toISOString(),
              salon: salonName.get(row.opticsId || '') || '',
              kind,
              ms: row.ms,
              newClient: !!meta.newClient,
              deposit: !!meta.deposit,
              chip: !!meta.chip,
              lens: !!meta.lens,
              frame: !!meta.frame,
              items: typeof meta.items === 'number' ? meta.items : 0,
            });
          }
        }
        if (meta.chip) chip += 1;
        if (meta.newClient) newClientUi += 1;
        if (meta.deposit) depositUi += 1;
      }
    }

    const byKind = { catalog: 0, rx: 0 };
    const byStatus: Record<string, number> = {};
    const products = new Map<string, number>();
    const lenses = new Map<string, number>();
    const frames = new Map<string, number>();
    const salonOrders = new Map<string, number>();
    let withDeposit = 0;
    let withAmount = 0;
    let revenue = 0;
    let pickupHours = 0;
    let pickupCount = 0;
    const clientFirst = new Map<string, Date>();

    for (const row of orders) {
      byKind[row.kind === OrderKind.rx ? 'rx' : 'catalog'] += 1;
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      bump(salonOrders, salonName.get(row.opticsId) || row.opticsId);
      if (row.paidAmount > 0) withDeposit += 1;
      if (typeof row.amount === 'number') {
        withAmount += 1;
        revenue += row.amount;
      }
      const prev = clientFirst.get(row.clientId);
      if (!prev || row.createdAt < prev) clientFirst.set(row.clientId, row.createdAt);
      for (const item of row.items) bump(products, item.name.trim(), item.qty);
      const rx = parseRxJson(row.rxJson);
      if (rx?.lens) bump(lenses, rx.lens.trim());
      if (rx?.frame) bump(frames, rx.frame.trim());
      if (row.status === 'picked_up') {
        const hours = (row.updatedAt.getTime() - row.createdAt.getTime()) / 36e5;
        if (hours >= 0 && hours < 24 * 60) {
          pickupHours += hours;
          pickupCount += 1;
        }
      }
    }

    const clients = await this.prisma.client.findMany({
      where: { id: { in: [...clientFirst.keys()] } },
      select: { id: true, createdAt: true },
    });
    let newOnOrder = 0;
    for (const client of clients) {
      const first = clientFirst.get(client.id);
      if (!first) continue;
      if (Math.abs(first.getTime() - client.createdAt.getTime()) < 5 * 60_000) {
        newOnOrder += 1;
      }
    }

    const notify: Record<string, number> = {};
    for (const row of notifications) {
      const key = `${row.channel}:${row.status}`;
      notify[key] = row._count._all;
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      ux: {
        sessions,
        pwa,
        opens,
        submits,
        holds,
        closes,
        abandon: Math.max(0, opens - submits - holds),
        pickerSelect,
        pickerCreate,
        chip,
        newClientUi,
        depositUi,
        screens: top(screens, 10),
        errors: top(errors, 8),
        time: {
          all: median(allMs),
          avg: avg(allMs),
          min: allMs.length ? Math.min(...allMs) : null,
          max: allMs.length ? Math.max(...allMs) : null,
          p90: p90(allMs),
          count: allMs.length,
          rx: median(submitMs.rx),
          catalog: median(submitMs.catalog),
          goods: median(stepMs.goods || []),
          client: median(stepMs.client || []),
        },
        creates,
      },
      sales: {
        orders: orders.length,
        revenue,
        avgCheck: withAmount ? Math.round(revenue / withAmount) : 0,
        byKind,
        byStatus,
        withDeposit,
        newOnOrder,
        returning: Math.max(0, clientFirst.size - newOnOrder),
        avgPickupHours: pickupCount ? Math.round((pickupHours / pickupCount) * 10) / 10 : null,
        products: top(products, 10),
        lenses: top(lenses, 8),
        frames: top(frames, 8),
        salons: top(salonOrders, 12),
      },
      notify,
    };
  }

  async csv(fromQ?: string, toQ?: string) {
    const data = await this.snapshot(fromQ, toQ);
    const yesNo = (v: boolean) => (v ? 'да' : 'нет');
    const sec = (ms: number | null) =>
      ms == null ? '' : Math.round(ms / 1000);
    const rows: unknown[][] = [
      ['Optika — тестовый период'],
      ['С', data.from],
      ['По', data.to],
      [],
      ['Показатель', 'Значение'],
      ['Один заказ, среднее сек', sec(data.ux.time.avg)],
      ['Один заказ, лучшее сек', sec(data.ux.time.min)],
      ['Один заказ, самое долгое сек', sec(data.ux.time.max)],
      ['Один заказ, медиана сек', sec(data.ux.time.all)],
      ['Один заказ, 90% быстрее сек', sec(data.ux.time.p90)],
      ['Заказов с замером времени', data.ux.time.count],
      ['Рецепт, медиана сек', sec(data.ux.time.rx)],
      ['Каталог, медиана сек', sec(data.ux.time.catalog)],
      ['Шаг товары, медиана сек', sec(data.ux.time.goods)],
      ['Шаг клиент, медиана сек', sec(data.ux.time.client)],
      ['Сессии', data.ux.sessions],
      ['PWA', data.ux.pwa],
      ['Открыли заказ', data.ux.opens],
      ['Сохранили', data.ux.submits],
      ['Отложили', data.ux.holds],
      ['Закрыли', data.ux.closes],
      ['Бросили', data.ux.abandon],
      ['Клиент из базы', data.ux.pickerSelect],
      ['Новый клиент в форме', data.ux.pickerCreate],
      ['Новый клиент при сохранении', data.ux.newClientUi],
      ['С залогом', data.ux.depositUi],
      ['Чип линзы/оправы', data.ux.chip],
      ['Заказы всего', data.sales.orders],
      ['Выручка', data.sales.revenue],
      ['Средний чек', data.sales.avgCheck],
      ['Рецепт, заказы', data.sales.byKind.rx],
      ['Каталог, заказы', data.sales.byKind.catalog],
      ['Новые клиенты', data.sales.newOnOrder],
      ['Повторные', data.sales.returning],
      ['До выдачи, часы', data.sales.avgPickupHours ?? ''],
      ...Object.entries(data.notify).map(([key, count]) => [`Сообщения ${key}`, count]),
      [],
      ['Сохранённый заказ — время создания'],
      [
        'Дата',
        'Салон',
        'Тип',
        'Секунды',
        'мс',
        'Новый клиент',
        'Залог',
        'Чип',
        'Линза',
        'Оправа',
        'Позиций',
      ],
      ...data.ux.creates.map((row) => [
        row.at,
        row.salon,
        row.kind === 'rx' ? 'рецепт' : 'каталог',
        Math.round(row.ms / 1000),
        row.ms,
        yesNo(row.newClient),
        yesNo(row.deposit),
        yesNo(row.chip),
        yesNo(row.lens),
        yesNo(row.frame),
        row.items || '',
      ]),
      [],
      ['Ошибки формы', 'Кол-во'],
      ...data.ux.errors.map((row) => [row.name, row.count]),
      [],
      ['Экран', 'Открытий'],
      ...data.ux.screens.map((row) => [row.name, row.count]),
      [],
      ['Товар', 'Кол-во'],
      ...data.sales.products.map((row) => [row.name, row.count]),
      [],
      ['Линза', 'Кол-во'],
      ...data.sales.lenses.map((row) => [row.name, row.count]),
      [],
      ['Оправа', 'Кол-во'],
      ...data.sales.frames.map((row) => [row.name, row.count]),
      [],
      ['Салон', 'Заказы'],
      ...data.sales.salons.map((row) => [row.name, row.count]),
    ];
    return csvRows(rows);
  }
}

function parseDay(value?: string) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function daysAgo(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() - n);
  return next;
}

function csvCell(value: unknown) {
  const s = value == null ? '' : String(value);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRows(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
}
