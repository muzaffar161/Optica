import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    await this.backfillSearchKeys();
  }

  private async backfillSearchKeys() {
    const clients = await this.client.findMany({
      where: { nameKey: '' },
      select: { id: true, fullName: true },
    });
    for (const client of clients) {
      await this.client.update({
        where: { id: client.id },
        data: { nameKey: client.fullName.trim().toLowerCase() },
      });
    }
    const orders = await this.order.findMany({
      where: { titleKey: '' },
      select: { id: true, title: true },
    });
    for (const order of orders) {
      await this.order.update({
        where: { id: order.id },
        data: { titleKey: order.title.trim().toLowerCase() },
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
