import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { planOrThrow } from './subscription.service';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'plan';
}

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.plan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { price: 'asc' },
    });
  }

  async get(id: string) {
    return planOrThrow(await this.prisma.plan.findUnique({ where: { id } }));
  }

  async create(dto: {
    name: string;
    slug?: string;
    description?: string;
    price: number;
    currency?: string;
    billingPeriod?: BillingPeriod;
    maxSalons: number;
    maxEmployees: number;
    includedSms: number;
    isActive?: boolean;
    statsLevel?: string;
    auditLevel?: string;
    canExport?: boolean;
    advancedRoles?: boolean;
    apiAccess?: boolean;
    prioritySupport?: boolean;
    recommended?: boolean;
  }) {
    this.validate(dto);
    const slug = await this.uniqueSlug(dto.slug || slugify(dto.name));
    return this.prisma.$transaction(async (tx) => {
      if (dto.recommended) {
        await tx.plan.updateMany({ data: { recommended: false } });
      }
      return tx.plan.create({
        data: {
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() ?? '',
          price: dto.price,
          currency: dto.currency?.trim() || 'UZS',
          billingPeriod: dto.billingPeriod || 'month',
          maxSalons: dto.maxSalons,
          maxEmployees: dto.maxEmployees,
          includedSms: dto.includedSms,
          statsLevel: dto.statsLevel || 'basic',
          auditLevel: dto.auditLevel || 'none',
          canExport: !!dto.canExport,
          advancedRoles: !!dto.advancedRoles,
          apiAccess: !!dto.apiAccess,
          prioritySupport: !!dto.prioritySupport,
          recommended: !!dto.recommended,
          isActive: dto.isActive !== false,
        },
      });
    });
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      slug: string;
      description: string;
      price: number;
      currency: string;
      billingPeriod: BillingPeriod;
      maxSalons: number;
      maxEmployees: number;
      includedSms: number;
      isActive: boolean;
      statsLevel: string;
      auditLevel: string;
      canExport: boolean;
      advancedRoles: boolean;
      apiAccess: boolean;
      prioritySupport: boolean;
      recommended: boolean;
    }>,
  ) {
    await this.get(id);
    if (
      dto.price != null ||
      dto.maxSalons != null ||
      dto.maxEmployees != null ||
      dto.includedSms != null
    ) {
      this.validate({
        price: dto.price ?? 0,
        maxSalons: dto.maxSalons ?? 1,
        maxEmployees: dto.maxEmployees ?? 0,
        includedSms: dto.includedSms ?? 0,
        skipName: true,
      });
    }
    let slug: string | undefined;
    if (dto.slug) slug = await this.uniqueSlug(slugify(dto.slug), id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.recommended === true) {
        await tx.plan.updateMany({
          where: { NOT: { id } },
          data: { recommended: false },
        });
      }
      return tx.plan.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(slug ? { slug } : {}),
          ...(dto.description != null ? { description: dto.description.trim() } : {}),
          ...(typeof dto.price === 'number' ? { price: dto.price } : {}),
          ...(dto.currency ? { currency: dto.currency.trim() } : {}),
          ...(dto.billingPeriod ? { billingPeriod: dto.billingPeriod } : {}),
          ...(typeof dto.maxSalons === 'number' ? { maxSalons: dto.maxSalons } : {}),
          ...(typeof dto.maxEmployees === 'number'
            ? { maxEmployees: dto.maxEmployees }
            : {}),
          ...(typeof dto.includedSms === 'number' ? { includedSms: dto.includedSms } : {}),
          ...(dto.statsLevel ? { statsLevel: dto.statsLevel } : {}),
          ...(dto.auditLevel ? { auditLevel: dto.auditLevel } : {}),
          ...(typeof dto.canExport === 'boolean' ? { canExport: dto.canExport } : {}),
          ...(typeof dto.advancedRoles === 'boolean' ? { advancedRoles: dto.advancedRoles } : {}),
          ...(typeof dto.apiAccess === 'boolean' ? { apiAccess: dto.apiAccess } : {}),
          ...(typeof dto.prioritySupport === 'boolean'
            ? { prioritySupport: dto.prioritySupport }
            : {}),
          ...(typeof dto.recommended === 'boolean' ? { recommended: dto.recommended } : {}),
          ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
        },
      });
    });
  }

  private validate(dto: {
    price: number;
    maxSalons: number;
    maxEmployees: number;
    includedSms: number;
    skipName?: boolean;
  }) {
    if (dto.price < 0) throw new BadRequestException('Цена не может быть отрицательной');
    if (dto.maxSalons < 1) throw new BadRequestException('Нужен хотя бы один салон');
    if (dto.maxEmployees < 0) {
      throw new BadRequestException('Лимит сотрудников не может быть отрицательным');
    }
    if (dto.includedSms < 0) throw new BadRequestException('SMS не может быть отрицательным');
  }

  private async uniqueSlug(base: string, exceptId?: string) {
    let slug = base;
    let i = 2;
    while (
      await this.prisma.plan.findFirst({
        where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      })
    ) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }
}

@Injectable()
export class SmsPackageAdminService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.smsPackage.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { smsCount: 'asc' },
    });
  }

  async get(id: string) {
    const row = await this.prisma.smsPackage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('SMS-пакет не найден');
    return row;
  }

  create(dto: { name: string; smsCount: number; price: number; currency?: string }) {
    this.validate(dto);
    return this.prisma.smsPackage.create({
      data: {
        name: dto.name.trim(),
        smsCount: dto.smsCount,
        price: dto.price,
        currency: dto.currency?.trim() || 'UZS',
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      smsCount: number;
      price: number;
      currency: string;
      isActive: boolean;
    }>,
  ) {
    await this.get(id);
    if (dto.smsCount != null || dto.price != null) {
      this.validate({
        smsCount: dto.smsCount ?? 1,
        price: dto.price ?? 0,
      });
    }
    return this.prisma.smsPackage.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(typeof dto.smsCount === 'number' ? { smsCount: dto.smsCount } : {}),
        ...(typeof dto.price === 'number' ? { price: dto.price } : {}),
        ...(dto.currency ? { currency: dto.currency.trim() } : {}),
        ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
      },
    });
  }

  private validate(dto: { smsCount: number; price: number }) {
    if (dto.smsCount < 1) throw new BadRequestException('В пакете должна быть хотя бы 1 SMS');
    if (dto.price < 0) throw new BadRequestException('Цена не может быть отрицательной');
  }
}
