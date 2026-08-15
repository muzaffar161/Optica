import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOpticsDto } from '../platform/dto/create-optics.dto';
import { normalizeOrderModes } from '../common/optics-features';
import { DEFAULT_TEMPLATE } from '../common/template';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class OrgNetworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async addSalon(organizationId: string, dto: CreateOpticsDto, orgOwner = false) {
    await this.subscriptions.assertCanCreateSalon(organizationId);
    const username = dto.username.trim().toLowerCase();
    const taken = await this.prisma.user.findUnique({ where: { username } });
    if (taken) {
      throw new ConflictException('Такой логин уже занят');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const modes = normalizeOrderModes(dto.catalogOrders, dto.rxOrders);
    const config = await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultTemplate: '' },
      update: {},
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const optics = await tx.optics.create({
          data: {
            organizationId,
            name: dto.name.trim(),
            catalogOrders: modes.catalogOrders,
            rxOrders: modes.rxOrders,
          },
        });
        await tx.user.create({
          data: {
            username,
            passwordHash,
            role: 'optics',
            opticsId: optics.id,
            organizationId,
            isOwner: true,
            orgOwner,
          },
        });
        await tx.settings.create({
          data: {
            opticsId: optics.id,
            opticsName: dto.name.trim(),
            address: 'укажите адрес в настройках',
            landmark: 'укажите ориентир в настройках',
            template: config.defaultTemplate || DEFAULT_TEMPLATE,
            templateKey: config.defaultTemplateKey,
          },
        });
        return tx.optics.findUniqueOrThrow({
          where: { id: optics.id },
          include: {
            users: { select: { id: true, username: true, createdAt: true } },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Такой логин уже занят');
      }
      throw error;
    }
  }

  async listOrganizations() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        optics: { select: { id: true, name: true, active: true } },
        wallet: { select: { balance: true } },
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
          orderBy: { startedAt: 'desc' },
        },
        _count: { select: { optics: true, users: true } },
      },
    });
    return orgs.map((org) => ({
      ...org,
      plan: org.subscriptions[0]?.plan ?? null,
      subscription: org.subscriptions[0] ?? null,
      smsBalance: org.wallet?.balance ?? 0,
    }));
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        optics: {
          include: {
            users: { select: { id: true, username: true, isOwner: true, orgOwner: true } },
          },
        },
        wallet: true,
        subscriptions: {
          include: { plan: true },
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!org) {
      throw new NotFoundException('Организация не найдена');
    }
    const summary = await this.subscriptions.summary(id);
    const txs = await this.prisma.smsTransaction.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { ...org, ...summary, transactions: txs };
  }
}
