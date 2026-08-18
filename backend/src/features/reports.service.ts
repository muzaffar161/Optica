import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { featuresOf } from '../common/plan-features';
import { parseRxJson } from '../common/rx';

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function parseDay(value?: string, fallback?: Date) {
  if (value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const next = new Date(value);
    if (!Number.isNaN(next.getTime())) return next;
  }
  return fallback ? new Date(fallback) : new Date();
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sumAmounts(rows: { amount: number | null }[]) {
  return rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
}

function bump(
  map: Map<string, { name: string; qty: number }>,
  raw: string,
  qty = 1,
) {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return;
  const key = name.toLowerCase().replace(/ё/g, 'е');
  const cur = map.get(key);
  if (cur) cur.qty += qty;
  else map.set(key, { name, qty });
}

function topOf(map: Map<string, { name: string; qty: number }>, take = 8) {
  return [...map.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, take);
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async get(
    organizationId: string,
    opticsId: string,
    orgOwner: boolean,
    fromQ?: string,
    toQ?: string,
    salonId?: string,
  ) {
    const plan = await this.subscriptions.getCurrentPlan(organizationId);
    const features = featuresOf(plan);
    const to = parseDay(toQ, new Date());
    to.setHours(23, 59, 59, 999);
    const from = parseDay(fromQ, startOfMonth(to));
    from.setHours(0, 0, 0, 0);
    if (from > to) from.setTime(to.getTime());
    if (features.statsLevel === 'basic') {
      const maxSpan = 31 * 24 * 60 * 60 * 1000;
      if (to.getTime() - from.getTime() > maxSpan) {
        from.setTime(to.getTime() - maxSpan);
        from.setHours(0, 0, 0, 0);
      }
    }

    const allSalonIds = await this.scopeIds(
      organizationId,
      opticsId,
      orgOwner,
      features.statsLevel === 'network',
    );
    const focusId =
      features.statsLevel === 'network' && orgOwner && salonId && allSalonIds.includes(salonId)
        ? salonId
        : null;
    const salonIds = focusId ? [focusId] : allSalonIds;
    const where = {
      opticsId: { in: salonIds },
      createdAt: { gte: from, lte: to },
    };

    const [orders, newClients, notifications] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          kind: true,
          opticsId: true,
          clientId: true,
          rxJson: true,
          items: { select: { name: true, qty: true } },
        },
      }),
      this.prisma.client.count({
        where: {
          opticsId: { in: salonIds },
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.notification.groupBy({
        by: ['channel'],
        where: {
          opticsId: { in: salonIds },
          createdAt: { gte: from, lte: to },
          status: { in: ['sent', 'mocked'] },
        },
        _count: { channel: true },
      }),
    ]);

    const revenue = sumAmounts(orders);
    const withAmount = orders.filter((row) => typeof row.amount === 'number').length;
    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const row of orders) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byKind[row.kind] = (byKind[row.kind] || 0) + 1;
    }
    const avgCheck = withAmount ? Math.round(revenue / withAmount) : 0;
    const basic = {
      from: from.toISOString(),
      to: to.toISOString(),
      orders: orders.length,
      revenue,
      newClients,
      avgCheck,
      byStatus,
    };

    if (features.statsLevel === 'basic') {
      return { features, basic };
    }

    const span = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - span);
    const prevOrders = await this.prisma.order.findMany({
      where: {
        opticsId: { in: salonIds },
        createdAt: { gte: prevFrom, lte: prevTo },
      },
      select: { amount: true, clientId: true },
    });
    const prevClients = await this.prisma.client.count({
      where: {
        opticsId: { in: salonIds },
        createdAt: { gte: prevFrom, lte: prevTo },
      },
    });
    const prevRevenue = sumAmounts(prevOrders);
    const prevWithAmount = prevOrders.filter((row) => typeof row.amount === 'number').length;

    const clientIds = [...new Set(orders.map((row) => row.clientId))];
    const returning = clientIds.length
      ? await this.prisma.order.findMany({
          where: {
            opticsId: { in: salonIds },
            clientId: { in: clientIds },
            createdAt: { lt: from },
          },
          select: { clientId: true },
          distinct: ['clientId'],
        })
      : [];

    const days: { day: string; orders: number; revenue: number }[] = [];
    const byDay = new Map<string, { orders: number; revenue: number }>();
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    const itemMap = new Map<string, { name: string; qty: number }>();
    const lensMap = new Map<string, { name: string; qty: number }>();
    const frameMap = new Map<string, { name: string; qty: number }>();
    let pickupHours = 0;
    let pickupCount = 0;

    for (const row of orders) {
      const key = dayKey(row.createdAt);
      const cur = byDay.get(key) || { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += row.amount ?? 0;
      byDay.set(key, cur);
      byWeekday[row.createdAt.getDay()] += 1;
      for (const item of row.items) {
        bump(itemMap, item.name, item.qty);
      }
      const rx = parseRxJson(row.rxJson);
      if (rx) {
        bump(lensMap, rx.lens ?? '');
        bump(frameMap, rx.frame ?? '');
      }
      if (row.status === 'picked_up') {
        const hours = (row.updatedAt.getTime() - row.createdAt.getTime()) / 36e5;
        if (hours >= 0 && hours < 24 * 60) {
          pickupHours += hours;
          pickupCount += 1;
        }
      }
    }

    const cursor = new Date(from);
    while (cursor <= to) {
      const key = dayKey(cursor);
      days.push({ day: key, ...(byDay.get(key) || { orders: 0, revenue: 0 }) });
      cursor.setDate(cursor.getDate() + 1);
    }

    const picked = byStatus.picked_up || 0;
    const cancelled = byStatus.cancelled || 0;
    const topItems = topOf(itemMap);
    const topLenses = topOf(lensMap);
    const topFrames = topOf(frameMap);

    const extended = {
      avgCheck,
      pickedUp: picked,
      cancelled,
      conversion: orders.length ? Math.round((picked / orders.length) * 100) : 0,
      cancelRate: orders.length ? Math.round((cancelled / orders.length) * 100) : 0,
      repeatClients: returning.length,
      avgPickupHours: pickupCount ? Math.round((pickupHours / pickupCount) * 10) / 10 : null,
      byKind,
      topLenses,
      topFrames,
      byWeekday,
      notifications: Object.fromEntries(
        notifications.map((row) => [row.channel, row._count.channel]),
      ),
      topItems,
      days,
      previous: {
        from: prevFrom.toISOString(),
        to: prevTo.toISOString(),
        orders: prevOrders.length,
        revenue: prevRevenue,
        newClients: prevClients,
        avgCheck: prevWithAmount ? Math.round(prevRevenue / prevWithAmount) : 0,
      },
    };

    let network:
      | {
          salons: {
            id: string;
            name: string;
            orders: number;
            revenue: number;
            pickedUp: number;
            cancelled: number;
          }[];
        }
      | undefined;
    if (features.statsLevel === 'network' && orgOwner) {
      const shops = await this.prisma.optics.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      const grouped = new Map<
        string,
        { orders: number; revenue: number; pickedUp: number; cancelled: number }
      >();
      const netOrders =
        focusId
          ? await this.prisma.order.findMany({
              where: {
                opticsId: { in: allSalonIds },
                createdAt: { gte: from, lte: to },
              },
              select: { amount: true, status: true, opticsId: true },
            })
          : orders;
      for (const row of netOrders) {
        const cur = grouped.get(row.opticsId) || {
          orders: 0,
          revenue: 0,
          pickedUp: 0,
          cancelled: 0,
        };
        cur.orders += 1;
        cur.revenue += row.amount ?? 0;
        if (row.status === 'picked_up') cur.pickedUp += 1;
        if (row.status === 'cancelled') cur.cancelled += 1;
        grouped.set(row.opticsId, cur);
      }
      network = {
        salons: shops.map((shop) => ({
          id: shop.id,
          name: shop.name,
          ...(grouped.get(shop.id) || {
            orders: 0,
            revenue: 0,
            pickedUp: 0,
            cancelled: 0,
          }),
        })),
      };
    }

    return { features, basic, extended, network, focusId };
  }

  private async scopeIds(
    organizationId: string,
    opticsId: string,
    orgOwner: boolean,
    network: boolean,
  ) {
    if (network && orgOwner) {
      const shops = await this.prisma.optics.findMany({
        where: { organizationId },
        select: { id: true },
      });
      return shops.map((row) => row.id);
    }
    return [opticsId];
  }
}
