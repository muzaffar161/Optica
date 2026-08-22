import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionService } from './subscription.service';
import { PlatformSmsService } from './platform-sms.service';
import { PaymentNumberService } from './payment-number.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './providers/payment-provider.interface';
import { pageParams } from '../common/pagination';
import { PaymentSettingsService } from './payment-settings.service';
import { personName } from '../common/person-name';

const OPEN: PaymentStatus[] = ['PENDING', 'WAITING_CONFIRMATION'];

const paymentInclude = {
  plan: true,
  smsPackage: true,
  organization: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: PaymentNumberService,
    private readonly pot: PlatformSmsService,
    private readonly subscriptions: SubscriptionService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly paymentSettings: PaymentSettingsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(opts: {
    organizationId: string;
    type: PaymentType;
    planId?: string;
    smsPackageId?: string;
  }) {
    if (opts.type === 'SUBSCRIPTION') {
      if (!opts.planId) throw new BadRequestException('Укажите тариф');
      return this.createSubscription(opts.organizationId, opts.planId);
    }
    if (!opts.smsPackageId) throw new BadRequestException('Укажите SMS-пакет');
    return this.createSmsPackage(opts.organizationId, opts.smsPackageId);
  }

  async createSubscription(organizationId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Тариф недоступен');
    }
    await this.assertPlanFits(organizationId, plan);
    const existing = await this.findOpen(organizationId, 'SUBSCRIPTION', {
      planId: plan.id,
    });
    if (existing) return this.view(existing);
    return this.insert({
      organizationId,
      type: 'SUBSCRIPTION',
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
    });
  }

  async createSmsPackage(organizationId: string, smsPackageId: string) {
    const prefs = await this.pot.prefs();
    if (prefs.smsViaDevice) {
      throw new ForbiddenException(
        'SMS отправляются с телефона салона. Покупка пакетов недоступна.',
      );
    }
    const pack = await this.prisma.smsPackage.findUnique({
      where: { id: smsPackageId },
    });
    if (!pack || !pack.isActive) {
      throw new BadRequestException('Пакет недоступен');
    }
    const existing = await this.findOpen(organizationId, 'SMS_PACKAGE', {
      smsPackageId: pack.id,
    });
    if (existing) return this.view(existing);
    return this.insert({
      organizationId,
      type: 'SMS_PACKAGE',
      smsPackageId: pack.id,
      amount: pack.price,
      currency: pack.currency,
    });
  }

  async getForOrg(organizationId: string, id: string) {
    const row = await this.expireOne(
      await this.prisma.payment.findFirst({
        where: { id, organizationId },
        include: paymentInclude,
      }),
    );
    if (!row) throw new NotFoundException('Платёж не найден');
    return this.view(row);
  }

  async listForOrg(organizationId: string, page?: string, pageSize?: string) {
    await this.expireDue(organizationId);
    const { page: p, take, skip } = pageParams(page, pageSize, 50);
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: items.map((row) => this.view(row)),
      total,
      page: p,
      pageSize: take,
    };
  }

  async listForPlatform(query: {
    status?: string;
    type?: string;
    method?: string;
    organizationId?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }) {
    await this.expireDue();
    const { page: p, take, skip } = pageParams(query.page, query.pageSize, 50);
    const where: Prisma.PaymentWhereInput = {};
    if (query.status && isStatus(query.status)) where.status = query.status;
    if (query.type && isType(query.type)) where.type = query.type;
    if (query.method && isMethod(query.method)) where.paymentMethod = query.method;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: items.map((row) => this.view(row)),
      total,
      page: p,
      pageSize: take,
    };
  }

  async getForPlatform(id: string) {
    const row = await this.expireOne(
      await this.prisma.payment.findUnique({
        where: { id },
        include: paymentInclude,
      }),
    );
    if (!row) throw new NotFoundException('Платёж не найден');
    return this.view(row);
  }

  async submit(
    organizationId: string,
    id: string,
    dto: {
      paymentMethod: PaymentMethod;
      payerName?: string;
      cardLast4?: string;
    },
  ) {
    const row = await this.expireOne(
      await this.prisma.payment.findFirst({
        where: { id, organizationId },
        include: paymentInclude,
      }),
    );
    if (!row) throw new NotFoundException('Платёж не найден');
    if (row.status === 'PAID' || row.status === 'REJECTED' || row.status === 'EXPIRED') {
      throw new BadRequestException('Этот платёж уже закрыт');
    }
    if (row.status === 'WAITING_CONFIRMATION') {
      throw new BadRequestException('Платёж уже отправлен на проверку');
    }
    const settings = await this.paymentSettings.get();
    this.paymentSettings.assertMethodEnabled(settings, dto.paymentMethod);
    const payerName = dto.payerName ? personName(dto.payerName) || null : null;
    const cardLast4 = normalizeLast4(dto.cardLast4);
    if (dto.paymentMethod === 'CARD_TRANSFER') {
      if (!payerName) throw new BadRequestException('Укажите имя плательщика');
      if (!cardLast4) {
        throw new BadRequestException('Укажите последние 4 цифры карты, с которой перевели');
      }
    }
    await this.provider.createPayment(row);
    const updated = await this.prisma.payment.update({
      where: { id: row.id },
      data: {
        status: 'WAITING_CONFIRMATION',
        paymentMethod: dto.paymentMethod,
        payerName,
        cardLast4,
      },
      include: paymentInclude,
    });
    this.alertAdmin('submitted', updated);
    return this.view(updated);
  }

  async confirm(id: string, confirmedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.payment.findUnique({
        where: { id },
        include: { plan: true, smsPackage: true },
      });
      if (!locked) throw new NotFoundException('Платёж не найден');
      if (this.isExpired(locked)) {
        await tx.payment.update({
          where: { id },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Срок оплаты истёк');
      }
      if (locked.status === 'PAID') {
        throw new BadRequestException('Платёж уже подтверждён');
      }
      if (locked.status !== 'WAITING_CONFIRMATION') {
        throw new BadRequestException('Подтвердить можно только платёж на проверке');
      }
      const claimed = await tx.payment.updateMany({
        where: { id, status: 'WAITING_CONFIRMATION' },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          confirmedBy,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Платёж уже обработан');
      }
      if (locked.type === 'SUBSCRIPTION') {
        if (!locked.plan) throw new BadRequestException('Тариф платежа не найден');
        await this.assertPlanFits(locked.organizationId, locked.plan, tx);
        await this.subscriptions.applyPaidPlan(
          tx,
          locked.organizationId,
          locked.plan,
        );
      } else {
        if (!locked.smsPackage) {
          throw new BadRequestException('SMS-пакет платежа не найден');
        }
        await this.pot.allocateFromPotInTx(tx, {
          organizationId: locked.organizationId,
          amount: locked.smsPackage.smsCount,
          type: 'PACKAGE_PURCHASE',
          description: `Пакет «${locked.smsPackage.name}», ${locked.smsPackage.smsCount} SMS (${locked.paymentNumber})`,
        });
      }
      const done = await tx.payment.findUniqueOrThrow({
        where: { id },
        include: paymentInclude,
      });
      return this.view(done);
    });
  }

  async setReviewStatus(
    id: string,
    dto: { status: 'PENDING' | 'WAITING_CONFIRMATION' | 'REJECTED'; reason?: string },
  ) {
    const row = await this.expireOne(
      await this.prisma.payment.findUnique({
        where: { id },
        include: paymentInclude,
      }),
    );
    if (!row) throw new NotFoundException('Платёж не найден');
    if (row.status === 'PAID') {
      throw new BadRequestException('Оплаченный платёж нельзя менять');
    }
    if (dto.status === 'REJECTED') {
      if (row.status === 'REJECTED') return this.view(row);
      const text = (dto.reason || 'Отклонено администратором').trim();
      if (text.length < 3) throw new BadRequestException('Укажите причину отклонения');
      return this.view(
        await this.prisma.payment.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectionReason: text,
            rejectedAt: new Date(),
          },
          include: paymentInclude,
        }),
      );
    }
    if (row.status === dto.status) return this.view(row);
    const hours = await this.expireHours();
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: null,
        rejectedAt: null,
        ...(row.status === 'EXPIRED'
          ? { expiresAt: new Date(Date.now() + hours * 3600 * 1000) }
          : {}),
      },
      include: paymentInclude,
    });
    return this.view(updated);
  }

  async reject(id: string, reason: string) {
    const text = reason.trim();
    if (text.length < 3) {
      throw new BadRequestException('Укажите причину отклонения');
    }
    const row = await this.expireOne(
      await this.prisma.payment.findUnique({
        where: { id },
        include: paymentInclude,
      }),
    );
    if (!row) throw new NotFoundException('Платёж не найден');
    if (row.status === 'PAID') {
      throw new BadRequestException('Оплаченный платёж нельзя отклонить');
    }
    if (row.status === 'REJECTED' || row.status === 'EXPIRED') {
      throw new BadRequestException('Платёж уже закрыт');
    }
    if (row.status !== 'WAITING_CONFIRMATION' && row.status !== 'PENDING') {
      throw new BadRequestException('Этот платёж нельзя отклонить');
    }
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: text,
        rejectedAt: new Date(),
      },
      include: paymentInclude,
    });
    return this.view(updated);
  }

  private async insert(data: {
    organizationId: string;
    type: PaymentType;
    planId?: string;
    smsPackageId?: string;
    amount: number;
    currency: string;
  }) {
    const hours = await this.expireHours();
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    for (let attempt = 0; attempt < 8; attempt++) {
      const paymentNumber = await this.numbers.next();
      try {
        const row = await this.prisma.payment.create({
          data: {
            paymentNumber,
            organizationId: data.organizationId,
            type: data.type,
            planId: data.planId,
            smsPackageId: data.smsPackageId,
            amount: data.amount,
            currency: data.currency,
            status: 'PENDING',
            expiresAt,
          },
          include: paymentInclude,
        });
        await this.provider.createPayment(row);
        this.alertAdmin('created', row);
        return this.view(row);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException('Не удалось выдать номер платежа, попробуйте ещё раз');
  }

  private async findOpen(
    organizationId: string,
    type: PaymentType,
    extra: { planId?: string; smsPackageId?: string },
  ) {
    const row = await this.expireOne(
      await this.prisma.payment.findFirst({
        where: { organizationId, type, status: { in: OPEN }, ...extra },
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
      }),
    );
    if (row && OPEN.includes(row.status)) return row;
    return null;
  }

  private async expireDue(organizationId?: string) {
    await this.prisma.payment.updateMany({
      where: {
        status: { in: OPEN },
        expiresAt: { lte: new Date() },
        ...(organizationId ? { organizationId } : {}),
      },
      data: { status: 'EXPIRED' },
    });
  }

  private async expireOne(
    row: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }> | null,
  ) {
    if (!row || !this.isExpired(row)) return row;
    return this.prisma.payment.update({
      where: { id: row.id },
      data: { status: 'EXPIRED' },
      include: paymentInclude,
    });
  }

  private isExpired(row: { status: PaymentStatus; expiresAt: Date | null }) {
    return (
      OPEN.includes(row.status) &&
      !!row.expiresAt &&
      row.expiresAt.getTime() <= Date.now()
    );
  }

  private async expireHours() {
    const config = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: { paymentExpireHours: true },
    });
    const hours = config?.paymentExpireHours ?? 24;
    return Math.min(168, Math.max(1, hours));
  }

  private async assertPlanFits(
    organizationId: string,
    plan: { maxSalons: number; maxEmployees: number },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const [salons, employees] = await Promise.all([
      db.optics.count({ where: { organizationId } }),
      db.user.count({
        where: { organizationId, role: 'optics', isOwner: false },
      }),
    ]);
    if (salons > plan.maxSalons) {
      throw new BadRequestException(
        `Сейчас ${salons} филиалов, а тариф позволяет ${plan.maxSalons}.`,
      );
    }
    if (plan.maxEmployees > 0 && employees > plan.maxEmployees) {
      throw new BadRequestException(
        `Сейчас ${employees} сотрудников, а тариф позволяет ${plan.maxEmployees}.`,
      );
    }
  }

  view(
    row: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>,
  ) {
    return {
      ...row,
      cardLast4: row.cardLast4 ? row.cardLast4 : null,
      purpose:
        row.type === 'SUBSCRIPTION'
          ? row.plan
            ? `Подписка «${row.plan.name}»`
            : 'Подписка'
          : row.smsPackage
            ? `SMS-пакет «${row.smsPackage.name}» (${row.smsPackage.smsCount} SMS)`
            : 'SMS-пакет',
    };
  }

  private alertAdmin(
    kind: 'created' | 'submitted',
    row: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>,
  ) {
    this.events.emit('payment.alert', { kind, payment: this.view(row) });
  }
}

function normalizeLast4(value?: string) {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== 4) {
    throw new BadRequestException('Нужны ровно 4 последние цифры карты');
  }
  return digits;
}

function isStatus(value: string): value is PaymentStatus {
  return ['PENDING', 'WAITING_CONFIRMATION', 'PAID', 'REJECTED', 'EXPIRED'].includes(
    value,
  );
}

function isType(value: string): value is PaymentType {
  return value === 'SUBSCRIPTION' || value === 'SMS_PACKAGE';
}

function isMethod(value: string): value is PaymentMethod {
  return value === 'CLICK' || value === 'CARD_TRANSFER';
}

export function assertOrgPayment(organizationId: string, paymentOrgId: string) {
  if (organizationId !== paymentOrgId) {
    throw new ForbiddenException('Нет доступа к этому платежу');
  }
}
