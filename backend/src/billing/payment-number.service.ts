import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async next(db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const stamp = this.dayStamp(new Date());
    const prefix = `OPT-${stamp}-`;
    for (let attempt = 0; attempt < 12; attempt++) {
      const count = await db.payment.count({
        where: { paymentNumber: { startsWith: prefix } },
      });
      const seq = String(count + 1 + attempt).padStart(4, '0');
      const paymentNumber = `${prefix}${seq}`;
      const taken = await db.payment.findUnique({
        where: { paymentNumber },
        select: { id: true },
      });
      if (!taken) return paymentNumber;
    }
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  private dayStamp(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
}
