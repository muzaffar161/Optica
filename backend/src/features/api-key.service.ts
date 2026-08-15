import { createHash, randomBytes } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { assertApi, featuresOf } from '../common/plan-features';

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private async assert(organizationId: string) {
    const plan = await this.subscriptions.getCurrentPlan(organizationId);
    assertApi(featuresOf(plan));
  }

  async list(organizationId: string) {
    await this.assert(organizationId);
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async create(organizationId: string, name: string) {
    await this.assert(organizationId);
    const raw = `opt_${randomBytes(24).toString('hex')}`;
    const row = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name: name.trim() || 'Ключ API',
        keyHash: hashKey(raw),
        prefix: raw.slice(0, 12),
      },
    });
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      key: raw,
    };
  }

  async revoke(organizationId: string, id: string) {
    await this.assert(organizationId);
    const row = await this.prisma.apiKey.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Ключ не найден');
    return this.prisma.apiKey.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true },
    });
  }

  async resolve(raw?: string) {
    if (!raw) throw new UnauthorizedException('Нужен заголовок X-Api-Key');
    const row = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashKey(raw) },
    });
    if (!row || !row.active) {
      throw new UnauthorizedException('Неверный API-ключ');
    }
    const plan = await this.subscriptions.getCurrentPlan(row.organizationId);
    if (!featuresOf(plan).apiAccess) {
      throw new ForbiddenException('API выключен на текущем тарифе');
    }
    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    return row.organizationId;
  }

  async publicOrders(organizationId: string) {
    const items = await this.prisma.order.findMany({
      where: { optics: { organizationId } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        amount: true,
        kind: true,
        createdAt: true,
        optics: { select: { id: true, name: true } },
        client: { select: { fullName: true, phone: true } },
      },
    });
    return { items };
  }

  async publicClients(organizationId: string) {
    const items = await this.prisma.client.findMany({
      where: { optics: { organizationId } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        fullName: true,
        phone: true,
        createdAt: true,
        optics: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
    });
    return { items };
  }

  async publicSalons(organizationId: string) {
    const items = await this.prisma.optics.findMany({
      where: { organizationId },
      select: { id: true, name: true, active: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }
}
