import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingPeriod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsWalletService } from './sms-wallet.service';

function addPeriod(from: Date, period: BillingPeriod) {
  const next = new Date(from);
  if (period === 'year') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: SmsWalletService,
  ) {}

  async getCurrentSubscription(organizationId: string) {
    const row = await this.prisma.subscription.findFirst({
      where: { organizationId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      return this.prisma.subscription.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
        include: { plan: true },
      });
    }
    return row;
  }

  async getCurrentPlan(organizationId: string) {
    const sub = await this.getCurrentSubscription(organizationId);
    return sub?.plan ?? null;
  }

  async assignPlan(organizationId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Тариф недоступен');
    }
    await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    await this.prisma.subscription.updateMany({
      where: { organizationId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
    const startedAt = new Date();
    const sub = await this.prisma.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        status: 'ACTIVE',
        startedAt,
        expiresAt: addPeriod(startedAt, plan.billingPeriod),
      },
      include: { plan: true },
    });
    if (plan.includedSms > 0) {
      await this.wallet.credit({
        organizationId,
        amount: plan.includedSms,
        type: 'SUBSCRIPTION_BONUS',
        description: `SMS по тарифу «${plan.name}»`,
      });
    }
    return sub;
  }

  async applyPaidPlan(
    tx: Prisma.TransactionClient,
    organizationId: string,
    plan: { id: string; name: string; billingPeriod: BillingPeriod; includedSms: number },
  ) {
    const now = new Date();
    const current = await tx.subscription.findFirst({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });
    const stillActive = current && current.expiresAt.getTime() >= now.getTime();
    if (stillActive && current.planId === plan.id) {
      const sub = await tx.subscription.update({
        where: { id: current.id },
        data: { expiresAt: addPeriod(current.expiresAt, plan.billingPeriod) },
        include: { plan: true },
      });
      if (plan.includedSms > 0) {
        await this.wallet.creditInTx(tx, {
          organizationId,
          amount: plan.includedSms,
          type: 'SUBSCRIPTION_BONUS',
          description: `SMS по тарифу «${plan.name}»`,
        });
      }
      return sub;
    }
    await tx.subscription.updateMany({
      where: { organizationId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
    const sub = await tx.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        status: 'ACTIVE',
        startedAt: now,
        expiresAt: addPeriod(now, plan.billingPeriod),
      },
      include: { plan: true },
    });
    if (plan.includedSms > 0) {
      await this.wallet.creditInTx(tx, {
        organizationId,
        amount: plan.includedSms,
        type: 'SUBSCRIPTION_BONUS',
        description: `SMS по тарифу «${plan.name}»`,
      });
    }
    return sub;
  }

  async salonCount(organizationId: string) {
    return this.prisma.optics.count({ where: { organizationId } });
  }

  async employeeCount(organizationId: string) {
    return this.prisma.user.count({
      where: { organizationId, role: 'optics', isOwner: false },
    });
  }

  async getRemainingSalonLimit(organizationId: string) {
    const plan = await this.requirePlan(organizationId);
    const used = await this.salonCount(organizationId);
    return Math.max(0, plan.maxSalons - used);
  }

  async getRemainingEmployeeLimit(organizationId: string) {
    const plan = await this.requirePlan(organizationId);
    if (plan.maxEmployees <= 0) return null;
    const used = await this.employeeCount(organizationId);
    return Math.max(0, plan.maxEmployees - used);
  }

  async canCreateSalon(organizationId: string) {
    const remaining = await this.getRemainingSalonLimit(organizationId);
    return remaining > 0;
  }

  async canCreateEmployee(organizationId: string) {
    const remaining = await this.getRemainingEmployeeLimit(organizationId);
    return remaining == null || remaining > 0;
  }

  async assertCanCreateSalon(organizationId: string) {
    const plan = await this.requirePlan(organizationId);
    const used = await this.salonCount(organizationId);
    if (used >= plan.maxSalons) {
      throw new ForbiddenException(
        `Текущий тариф позволяет до ${plan.maxSalons} салонов. Расширьте подписку.`,
      );
    }
  }

  async assertCanCreateEmployee(organizationId: string) {
    const plan = await this.requirePlan(organizationId);
    if (plan.maxEmployees <= 0) return;
    const used = await this.employeeCount(organizationId);
    if (used >= plan.maxEmployees) {
      throw new ForbiddenException(
        `Текущий тариф позволяет до ${plan.maxEmployees} сотрудников. Расширьте подписку.`,
      );
    }
  }

  async requirePlan(organizationId: string) {
    const plan = await this.getCurrentPlan(organizationId);
    if (!plan) {
      throw new ForbiddenException('Нет активной подписки. Обратитесь в поддержку.');
    }
    return plan;
  }

  async summary(organizationId: string) {
    const [sub, salonCount, employeeCount, wallet, plans] = await Promise.all([
      this.getCurrentSubscription(organizationId),
      this.salonCount(organizationId),
      this.employeeCount(organizationId),
      this.wallet.getWallet(organizationId),
      this.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      }),
    ]);
    return {
      subscription: sub,
      plan: sub?.plan ?? null,
      salonCount,
      employeeCount,
      smsBalance: wallet.balance,
      plans,
    };
  }
}

export function planOrThrow(row: Prisma.PlanGetPayload<object> | null) {
  if (!row) throw new NotFoundException('Тариф не найден');
  return row;
}
