import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OpticsFeatures = {
  catalogOrders: boolean;
  rxOrders: boolean;
};

export async function opticsFeatures(
  prisma: PrismaService,
  opticsId: string,
): Promise<OpticsFeatures> {
  const shop = await prisma.optics.findUnique({
    where: { id: opticsId },
    select: { catalogOrders: true, rxOrders: true },
  });
  if (!shop) {
    throw new NotFoundException('Салон не найден');
  }
  return shop;
}

export async function assertCatalogEnabled(
  prisma: PrismaService,
  opticsId: string,
) {
  const shop = await opticsFeatures(prisma, opticsId);
  if (!shop.catalogOrders) {
    throw new ForbiddenException('Каталог товаров для этого салона выключен');
  }
}

export function normalizeOrderModes(catalog?: boolean, rx?: boolean) {
  const catalogOrders = catalog !== false;
  const rxOrders = !!rx;
  if (!catalogOrders && !rxOrders) {
    return { catalogOrders: true, rxOrders: false };
  }
  return { catalogOrders, rxOrders };
}
