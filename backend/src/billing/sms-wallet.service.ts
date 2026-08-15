import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SmsTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmsWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(organizationId: string) {
    return this.prisma.smsWallet.upsert({
      where: { organizationId },
      create: { organizationId, balance: 0 },
      update: {},
    });
  }

  async getBalance(organizationId: string) {
    const wallet = await this.getWallet(organizationId);
    return wallet.balance;
  }

  async credit(opts: {
    organizationId: string;
    amount: number;
    type: SmsTxType;
    description: string;
    notificationId?: string;
  }) {
    if (opts.amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.prisma.$transaction((tx) =>
      this.creditInTx(tx, opts),
    );
  }

  async creditInTx(
    tx: Prisma.TransactionClient,
    opts: {
      organizationId: string;
      amount: number;
      type: SmsTxType;
      description: string;
      notificationId?: string;
    },
  ) {
    if (opts.amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.apply(
      tx,
      opts.organizationId,
      opts.amount,
      opts.type,
      opts.description,
      opts.notificationId,
    );
  }

  async debit(opts: {
    organizationId: string;
    amount: number;
    type: SmsTxType;
    description: string;
    notificationId?: string;
  }) {
    if (opts.amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.prisma.$transaction((tx) =>
      this.apply(
        tx,
        opts.organizationId,
        -opts.amount,
        opts.type,
        opts.description,
        opts.notificationId,
      ),
    );
  }

  async stats(organizationId: string) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const [wallet, sent, bonus, bought] = await Promise.all([
      this.getWallet(organizationId),
      this.prisma.smsTransaction.aggregate({
        where: {
          organizationId,
          type: 'MESSAGE_SENT',
          createdAt: { gte: start },
        },
        _sum: { amount: true },
      }),
      this.prisma.smsTransaction.aggregate({
        where: {
          organizationId,
          type: 'SUBSCRIPTION_BONUS',
          createdAt: { gte: start },
        },
        _sum: { amount: true },
      }),
      this.prisma.smsTransaction.aggregate({
        where: {
          organizationId,
          type: 'PACKAGE_PURCHASE',
          createdAt: { gte: start },
        },
        _sum: { amount: true },
      }),
    ]);
    return {
      balance: wallet.balance,
      sent: Math.abs(sent._sum.amount ?? 0),
      subscriptionBonus: bonus._sum.amount ?? 0,
      purchased: bought._sum.amount ?? 0,
    };
  }

  async listTransactions(organizationId: string, page?: string, pageSize?: string) {
    const take = Math.min(100, Math.max(1, Number(pageSize) || 50));
    const p = Math.max(1, Number(page) || 1);
    const skip = (p - 1) * take;
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.smsTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.smsTransaction.count({ where }),
    ]);
    return { items, total, page: p, pageSize: take };
  }

  private async apply(
    tx: Prisma.TransactionClient,
    organizationId: string,
    amount: number,
    type: SmsTxType,
    description: string,
    notificationId?: string,
  ) {
    const wallet = await tx.smsWallet.upsert({
      where: { organizationId },
      create: { organizationId, balance: 0 },
      update: {},
    });
    const next = wallet.balance + amount;
    if (next < 0) {
      throw new BadRequestException('Недостаточно SMS на балансе');
    }
    const updated = await tx.smsWallet.update({
      where: { id: wallet.id },
      data: { balance: next },
    });
    const row = await tx.smsTransaction.create({
      data: {
        organizationId,
        amount,
        type,
        description,
        notificationId,
        balanceAfter: updated.balance,
      },
    });
    return { wallet: updated, transaction: row };
  }
}

export function smsPackageOrThrow(row: Prisma.SmsPackageGetPayload<object> | null) {
  if (!row) throw new NotFoundException('SMS-пакет не найден');
  return row;
}
