import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { foldText, toE164 } from '../common/phone';
import { pageParams } from '../common/pagination';
import { searchTokens } from '../common/search';
import {
  archiveCutoff,
  archiveData,
  archivedWhere,
  currentArchiveWhere,
  isArchivedRow,
} from '../common/archive';

function clientSearch(q?: string): Prisma.ClientWhereInput | undefined {
  const tokens = searchTokens(q);
  if (!tokens) {
    return undefined;
  }
  const and: Prisma.ClientWhereInput[] = tokens.text.map((token) => ({
    nameKey: { contains: token },
  }));
  for (const d of tokens.digits) {
    and.push({ phone: { contains: d } });
  }
  return and.length === 1 ? and[0] : { AND: and };
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    opticsId: string,
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
    const where: Prisma.ClientWhereInput = {
      opticsId,
      ...clientSearch(q),
    };
    if (!searching) {
      Object.assign(
        where,
        inArchive ? archivedWhere(cutoff) : currentArchiveWhere(cutoff),
      );
    }
    const { page: p, take, skip } = pageParams(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);
    return {
      items: items.map((client) => ({
        ...client,
        archived: isArchivedRow(client, cutoff),
      })),
      total,
      page: p,
      pageSize: take,
      archive: inArchive,
      archiveAfterDays: settings?.archiveAfterDays ?? 10,
      searched: searching,
    };
  }

  async findOne(opticsId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, opticsId },
      include: { orders: { orderBy: { createdAt: 'desc' } } },
    });
    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }
    return client;
  }

  async create(opticsId: string, dto: CreateClientDto) {
    const phone = toE164(dto.phone);
    if (!phone) {
      throw new BadRequestException('Некорректный номер телефона');
    }
    try {
      return await this.prisma.client.create({
        data: {
          opticsId,
          fullName: dto.fullName.trim(),
          nameKey: foldText(dto.fullName),
          phone,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Клиент с таким телефоном уже есть');
      }
      throw error;
    }
  }

  async update(opticsId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(opticsId, id);
    const data: Prisma.ClientUpdateInput = {};
    if (dto.fullName) {
      data.fullName = dto.fullName.trim();
      data.nameKey = foldText(dto.fullName);
    }
    if (dto.phone) {
      const phone = toE164(dto.phone);
      if (!phone) {
        throw new BadRequestException('Некорректный номер телефона');
      }
      data.phone = phone;
    }
    if (typeof dto.archived === 'boolean') {
      Object.assign(data, archiveData(dto.archived));
    }
    try {
      return await this.prisma.client.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Клиент с таким телефоном уже есть');
      }
      throw error;
    }
  }

  async remove(opticsId: string, id: string) {
    await this.findOne(opticsId, id);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}
