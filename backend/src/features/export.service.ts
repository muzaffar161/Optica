import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { assertExport, featuresOf } from '../common/plan-features';

function cell(value: unknown) {
  const s = value == null ? '' : String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\n')}`;
}

const STATUS: Record<string, string> = {
  new: 'Принято',
  in_progress: 'В работе',
  ready: 'Готов',
  picked_up: 'Выдан',
  cancelled: 'Отменён',
};

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private async assert(organizationId: string) {
    const plan = await this.subscriptions.getCurrentPlan(organizationId);
    assertExport(featuresOf(plan));
  }

  async ordersCsv(organizationId: string, opticsId: string) {
    await this.assert(organizationId);
    const items = await this.prisma.order.findMany({
      where: { opticsId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return csv([
      ['Дата', 'Статус', 'Заказ', 'Сумма', 'Клиент', 'Телефон', 'Тип'],
      ...items.map((row) => [
        row.createdAt.toISOString(),
        STATUS[row.status] || row.status,
        row.title,
        row.amount ?? '',
        row.client.fullName,
        row.client.phone,
        row.kind === 'rx' ? 'рецепт' : 'каталог',
      ]),
    ]);
  }

  async clientsCsv(organizationId: string, opticsId: string) {
    await this.assert(organizationId);
    const items = await this.prisma.client.findMany({
      where: { opticsId },
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return csv([
      ['Имя', 'Телефон', 'Создан', 'Заказов'],
      ...items.map((row) => [
        row.fullName,
        row.phone,
        row.createdAt.toISOString(),
        row._count.orders,
      ]),
    ]);
  }
}
