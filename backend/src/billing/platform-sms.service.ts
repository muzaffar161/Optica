import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, SmsTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { clampSmsCharLimit } from '../common/template';
import { clampSubscriptionWarnDays } from '../common/subscription';
import { SmsWalletService } from './sms-wallet.service';

type PotMeta = {
  kind?: string;
  organizationId?: string;
};

@Injectable()
export class PlatformSmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bowls: SmsWalletService,
  ) {}

  async config() {
    return this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultTemplate: '', smsBalance: 0, botLink: '' },
      update: {},
    });
  }

  async charLimit() {
    const row = await this.config();
    return clampSmsCharLimit(row.smsCharLimit);
  }

  async prefs() {
    const row = await this.config();
    return {
      smsCharLimit: clampSmsCharLimit(row.smsCharLimit),
      smsToLatin: Boolean(row.smsToLatin),
      smsViaDevice: Boolean(row.smsViaDevice),
      subscriptionWarnDays: clampSubscriptionWarnDays(row.subscriptionWarnDays),
    };
  }

  async setToLatin(value: boolean) {
    await this.config();
    return this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: { smsToLatin: value },
    });
  }

  async setViaDevice(value: boolean) {
    await this.config();
    return this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: { smsViaDevice: value },
    });
  }

  async setWarnDays(value: number) {
    await this.config();
    return this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: { subscriptionWarnDays: clampSubscriptionWarnDays(value) },
    });
  }

  async setCharLimit(limit: number) {
    const smsCharLimit = clampSmsCharLimit(limit);
    await this.config();
    return this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: { smsCharLimit },
    });
  }

  async snapshot() {
    const row = await this.config();
    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    const [txs, orgs, wallets, sentMonth, welcomeMonth] = await Promise.all([
      this.prisma.platformSmsTx.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.organization.findMany({
        select: { id: true, name: true, _count: { select: { optics: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.smsWallet.findMany(),
      this.prisma.smsTransaction.groupBy({
        by: ['organizationId'],
        where: { type: 'MESSAGE_SENT', createdAt: { gte: month } },
        _sum: { amount: true },
      }),
      this.prisma.platformSmsTx.aggregate({
        where: { kind: 'welcome', createdAt: { gte: month } },
        _sum: { amount: true },
      }),
    ]);
    const sentMap = new Map(
      sentMonth.map((row) => [row.organizationId, Math.abs(row._sum.amount ?? 0)]),
    );
    const walletMap = new Map(wallets.map((row) => [row.organizationId, row.balance]));
    const bowls = orgs
      .map((org) => ({
        organizationId: org.id,
        name: org.name,
        salons: org._count.optics,
        balance: walletMap.get(org.id) ?? 0,
        sentMonth: sentMap.get(org.id) ?? 0,
      }))
      .sort((a, b) => b.balance - a.balance || b.sentMonth - a.sentMonth);
    const inBowls = bowls.reduce((sum, bowl) => sum + bowl.balance, 0);
    return {
      balance: row.smsBalance,
      inBowls,
      botLink: row.botLink,
      smsCharLimit: clampSmsCharLimit(row.smsCharLimit),
      smsToLatin: Boolean(row.smsToLatin),
      smsViaDevice: Boolean(row.smsViaDevice),
      subscriptionWarnDays: clampSubscriptionWarnDays(row.subscriptionWarnDays),
      welcomeMonth: Math.abs(welcomeMonth._sum.amount ?? 0),
      bowls,
      transactions: txs,
    };
  }

  async setBotLink(link: string) {
    const value = link.trim();
    await this.config();
    return this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: { botLink: value },
    });
  }

  async adjust(amount: number, reason: string) {
    if (!amount) return this.snapshot();
    await this.apply(amount, 'ADJUSTMENT', reason.trim() || 'Закупка SMS', { kind: 'stock' });
    return this.snapshot();
  }

  async debit(amount: number, description: string, meta?: PotMeta) {
    if (amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.apply(-amount, 'MESSAGE_SENT', description, meta);
  }

  async credit(amount: number, description: string, meta?: PotMeta) {
    if (amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.apply(amount, 'REFUND', description, meta);
  }

  async allocateFromPot(opts: {
    organizationId: string;
    amount: number;
    type: SmsTxType;
    description: string;
  }) {
    return this.prisma.$transaction((tx) => this.allocateFromPotInTx(tx, opts));
  }

  async allocateFromPotInTx(
    tx: Prisma.TransactionClient,
    opts: {
      organizationId: string;
      amount: number;
      type: SmsTxType;
      description: string;
    },
  ) {
    await this.applyInTx(tx, -opts.amount, opts.type, opts.description, {
      kind: 'allocate',
      organizationId: opts.organizationId,
    });
    return this.bowls.creditInTx(tx, opts);
  }

  async reclaimToPot(opts: { organizationId: string; amount: number; description: string }) {
    return this.prisma.$transaction((tx) => this.reclaimToPotInTx(tx, opts));
  }

  async reclaimToPotInTx(
    tx: Prisma.TransactionClient,
    opts: { organizationId: string; amount: number; description: string },
  ) {
    const bowl = await this.bowls.debitInTx(tx, {
      organizationId: opts.organizationId,
      amount: opts.amount,
      type: 'ADJUSTMENT',
      description: opts.description,
    });
    await this.applyInTx(tx, opts.amount, 'ADJUSTMENT', opts.description, {
      kind: 'reclaim',
      organizationId: opts.organizationId,
    });
    return bowl;
  }

  private apply(amount: number, type: SmsTxType, description: string, meta?: PotMeta) {
    return this.prisma.$transaction((tx) => this.applyInTx(tx, amount, type, description, meta));
  }

  private async applyInTx(
    tx: Prisma.TransactionClient,
    amount: number,
    type: SmsTxType,
    description: string,
    meta?: PotMeta,
  ) {
    if (!amount) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    const row = await tx.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultTemplate: '', smsBalance: 0, botLink: '' },
      update: {},
    });
    const next = row.smsBalance + amount;
    if (next < 0) {
      throw new BadRequestException('Недостаточно SMS в общем запасе');
    }
    const updated = await tx.platformConfig.update({
      where: { id: 'default' },
      data: { smsBalance: next },
    });
    const transaction = await tx.platformSmsTx.create({
      data: {
        amount,
        type,
        description,
        balanceAfter: updated.smsBalance,
        kind: meta?.kind || (amount > 0 ? 'stock' : ''),
        organizationId: meta?.organizationId || '',
      },
    });
    return { balance: updated.smsBalance, transaction };
  }
}
