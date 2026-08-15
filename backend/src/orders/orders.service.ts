import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderKind, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { CreateOrderDto, RxPayloadDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { pageParams } from '../common/pagination';
import { foldText } from '../common/phone';
import {
  archiveCutoff,
  archiveData,
  archivedWhere,
  currentArchiveWhere,
  isArchivedRow,
} from '../common/archive';
import { searchTokens } from '../common/search';
import { opticsFeatures } from '../common/optics-features';
import { formatRxTitle, signedRx } from '../common/rx';

const orderInclude = {
  client: true,
  items: true,
  notifications: { orderBy: { createdAt: 'desc' as const }, take: 5 },
};

function clean(value?: string) {
  return value?.trim() ?? '';
}

function rxHasContent(rx?: RxPayloadDto) {
  if (!rx) return false;
  if (clean(rx.lens) || clean(rx.frame)) return true;
  return (rx.blocks ?? []).some((block) => {
    return (
      clean(block.dpp) ||
      clean(block.od?.sph) ||
      clean(block.od?.cyl) ||
      clean(block.od?.ax) ||
      clean(block.os?.sph) ||
      clean(block.os?.cyl) ||
      clean(block.os?.ax)
    );
  });
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly clients: ClientsService,
  ) {}

  async findAll(
    opticsId: string,
    status?: OrderStatus,
    q?: string,
    page?: string,
    pageSize?: string,
    archive?: string,
  ) {
    const settings = await this.prisma.settings.findUnique({
      where: { opticsId },
      select: { archiveAfterDays: true },
    });
    const cutoff = archiveCutoff(settings?.archiveAfterDays);
    const inArchive = archive === '1' || archive === 'true';
    const tokens = searchTokens(q);
    const searching = !!tokens;
    const where: Prisma.OrderWhereInput = { opticsId };
    if (!searching) {
      Object.assign(where, inArchive ? archivedWhere(cutoff) : currentArchiveWhere(cutoff));
    }
    if (status) {
      where.status = status;
    }
    if (tokens) {
      const and: Prisma.OrderWhereInput[] = tokens.text.map((token) => ({
        OR: [
          { titleKey: { contains: token } },
          { client: { nameKey: { contains: token } } },
        ],
      }));
      for (const d of tokens.digits) {
        and.push({ client: { phone: { contains: d } } });
      }
      where.AND = and;
    }
    const { page: p, take, skip } = pageParams(page, pageSize);
    const dateFilter = inArchive ? archivedWhere(cutoff) : currentArchiveWhere(cutoff);
    const [items, total, statusRows] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { opticsId, ...dateFilter },
        _count: { status: true },
      }),
    ]);
    return {
      items: items.map((order) => ({
        ...order,
        archived: isArchivedRow(order, cutoff),
      })),
      total,
      page: p,
      pageSize: take,
      archive: inArchive,
      archiveAfterDays: settings?.archiveAfterDays ?? 10,
      searched: searching,
      counts: Object.fromEntries(
        statusRows.map((row) => [row.status, row._count.status]),
      ) as Record<OrderStatus, number>,
    };
  }

  async findOne(opticsId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, opticsId },
      include: {
        client: true,
        notifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }
    return order;
  }

  async create(opticsId: string, dto: CreateOrderDto) {
    const features = await opticsFeatures(this.prisma, opticsId);
    const kind: OrderKind = dto.kind === 'rx' ? OrderKind.rx : OrderKind.catalog;
    if (kind === OrderKind.rx && !features.rxOrders) {
      throw new BadRequestException('Заказы по рецепту для этого салона выключены');
    }
    if (kind === OrderKind.catalog && !features.catalogOrders) {
      throw new BadRequestException('Каталог товаров для этого салона выключен');
    }

    let clientId = dto.clientId;
    if (!clientId && dto.client) {
      const client = await this.clients.create(opticsId, dto.client);
      clientId = client.id;
    }
    if (!clientId) {
      throw new BadRequestException('Укажите клиента или создайте нового');
    }
    await this.clients.findOne(opticsId, clientId);

    if (kind === OrderKind.rx) {
      if (!rxHasContent(dto.rx)) {
        throw new BadRequestException('Заполните рецепт, линзу или оправу');
      }
      const rx = signedRx(dto.rx!);
      const title = [dto.title?.trim() || formatRxTitle(rx, dto.amount), dto.note?.trim()]
        .filter(Boolean)
        .join('. ');
      return this.prisma.order.create({
        data: {
          title,
          titleKey: foldText(title),
          kind,
          amount: dto.amount,
          rxJson: JSON.stringify(rx),
          clientId,
          opticsId,
        },
        include: orderInclude,
      });
    }

    const rawItems = dto.items ?? [];
    const uniqueIds = [...new Set(rawItems.map((item) => item.productId))];
    const products =
      uniqueIds.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: { opticsId, id: { in: uniqueIds } },
          });
    if (products.length !== uniqueIds.length) {
      throw new BadRequestException('Один из товаров не найден');
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines = rawItems.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException('Один из товаров не найден');
      }
      return {
        productId: product.id,
        name: product.name,
        qty: item.qty,
        photoPath: product.photoPath,
      };
    });

    const fromItems = lines
      .map((line) => (line.qty > 1 ? `${line.name} ×${line.qty}` : line.name))
      .join(', ');
    const note = dto.note?.trim() ?? '';
    const title = [dto.title?.trim() || fromItems, note]
      .filter(Boolean)
      .join('. ');
    if (!title) {
      throw new BadRequestException('Выберите товары или укажите название');
    }

    return this.prisma.order.create({
      data: {
        title,
        titleKey: foldText(title),
        kind: OrderKind.catalog,
        amount: dto.amount,
        clientId,
        opticsId,
        items: lines.length ? { create: lines } : undefined,
      },
      include: orderInclude,
    });
  }

  async update(opticsId: string, id: string, dto: UpdateOrderDto) {
    await this.findOne(opticsId, id);
    return this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.title
          ? { title: dto.title.trim(), titleKey: foldText(dto.title) }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(typeof dto.archived === 'boolean' ? archiveData(dto.archived) : {}),
      },
      include: orderInclude,
    });
  }

  async remove(opticsId: string, id: string) {
    await this.findOne(opticsId, id);
    await this.prisma.order.delete({ where: { id } });
    return { ok: true };
  }

  async notifyReady(opticsId: string, id: string) {
    await this.findOne(opticsId, id);
    await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.ready },
    });
    await this.events.emitAsync('order.ready', { orderId: id });
    return this.findOne(opticsId, id);
  }

  async resend(opticsId: string, id: string) {
    await this.findOne(opticsId, id);
    await this.events.emitAsync('order.ready', { orderId: id });
    return this.findOne(opticsId, id);
  }
}
