import { BadRequestException, Injectable } from '@nestjs/common';
import { SmsTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { clampSmsCharLimit } from '../common/template';

@Injectable()
export class PlatformSmsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const txs = await this.prisma.platformSmsTx.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      balance: row.smsBalance,
      botLink: row.botLink,
      smsCharLimit: clampSmsCharLimit(row.smsCharLimit),
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
    await this.apply(amount, 'ADJUSTMENT', reason.trim() || 'Корректировка');
    return this.snapshot();
  }

  async debit(amount: number, description: string) {
    if (amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.apply(-amount, 'MESSAGE_SENT', description);
  }

  async credit(amount: number, description: string) {
    if (amount <= 0) {
      throw new BadRequestException('Количество SMS должно быть больше нуля');
    }
    return this.apply(amount, 'REFUND', description);
  }

  private async apply(amount: number, type: SmsTxType, description: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.platformConfig.upsert({
        where: { id: 'default' },
        create: { id: 'default', defaultTemplate: '', smsBalance: 0, botLink: '' },
        update: {},
      });
      const next = row.smsBalance + amount;
      if (next < 0) {
        throw new BadRequestException('Недостаточно SMS на счёте продукта');
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
        },
      });
      return { balance: updated.smsBalance, transaction };
    });
  }
}
