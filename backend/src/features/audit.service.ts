import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { featuresOf } from '../common/plan-features';
import { SubscriptionService } from '../billing/subscription.service';
import { pageParams } from '../common/pagination';

export type AuditPayload = {
  organizationId?: string | null;
  opticsId?: string | null;
  userId?: string | null;
  username?: string;
  action: string;
  entity?: string;
  entityId?: string;
  summary?: string;
  meta?: unknown;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  @OnEvent('audit.log')
  async onLog(payload: AuditPayload) {
    try {
      await this.write(payload);
    } catch (err) {
      this.logger.warn(err instanceof Error ? err.message : 'audit failed');
    }
  }

  async write(payload: AuditPayload) {
    let organizationId = payload.organizationId || null;
    if (!organizationId && payload.opticsId) {
      const optics = await this.prisma.optics.findUnique({
        where: { id: payload.opticsId },
        select: { organizationId: true },
      });
      organizationId = optics?.organizationId ?? null;
    }
    if (!organizationId) return;
    await this.prisma.auditEvent.create({
      data: {
        organizationId,
        opticsId: payload.opticsId || null,
        userId: payload.userId || null,
        username: payload.username || '',
        action: payload.action,
        entity: payload.entity || '',
        entityId: payload.entityId || '',
        summary: payload.summary || '',
        meta:
          payload.meta == null
            ? ''
            : typeof payload.meta === 'string'
              ? payload.meta
              : JSON.stringify(payload.meta),
      },
    });
  }

  async list(
    organizationId: string,
    opticsId: string | null,
    orgOwner: boolean,
    page?: string,
    pageSize?: string,
    salonId?: string,
  ) {
    const plan = await this.subscriptions.getCurrentPlan(organizationId);
    const features = featuresOf(plan);
    if (features.auditLevel === 'none') {
      return { items: [], total: 0, page: 1, pageSize: 50, features };
    }
    const { skip, take, page: p } = pageParams(page, pageSize, 50);
    const where = {
      organizationId,
      ...(features.auditLevel === 'extended' && orgOwner
        ? salonId
          ? { opticsId: salonId }
          : {}
        : { opticsId: opticsId || undefined }),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    const salons = orgOwner
      ? await this.prisma.optics.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [];
    return {
      items: items.map((row) => ({
        ...row,
        meta:
          features.auditLevel === 'extended' && row.meta
            ? safeJson(row.meta)
            : null,
      })),
      total,
      page: p,
      pageSize: take,
      features,
      salons,
    };
  }
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
