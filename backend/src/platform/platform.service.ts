import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOpticsDto } from './dto/create-optics.dto';
import { UpdateOpticsDto } from './dto/update-optics.dto';
import { DEFAULT_TEMPLATE, matchTemplateKey } from '../common/template';
import { MessageTemplatesService } from '../settings/message-templates.service';
import { normalizeOrderModes } from '../common/optics-features';
import { SubscriptionService } from '../billing/subscription.service';

const opticsInclude = {
  users: { select: { id: true, username: true, createdAt: true } },
  settings: {
    select: {
      template: true,
      templateKey: true,
      templateCustom: true,
      address: true,
      landmark: true,
      phone: true,
      hours: true,
    },
  },
  _count: {
    select: {
      clients: true,
      orders: true,
      notifications: true,
    },
  },
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly messageTemplates: MessageTemplatesService,
  ) {}

  async defaultConfig() {
    const config = await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultTemplate: DEFAULT_TEMPLATE },
      update: {},
    });
    return {
      defaultTemplate: config.defaultTemplate,
      defaultTemplateKey: config.defaultTemplateKey,
    };
  }

  async getConfig() {
    const config = await this.defaultConfig();
    return {
      ...config,
      templates: await this.messageTemplates.list(),
    };
  }

  async updateConfig(defaultTemplate: string, defaultTemplateKey?: string) {
    const template = defaultTemplate.trim();
    const key = defaultTemplateKey || matchTemplateKey(template);
    await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        defaultTemplate: template,
        defaultTemplateKey: key,
      },
      update: { defaultTemplate: template, defaultTemplateKey: key },
    });
    return this.getConfig();
  }

  async stats() {
    const [
      opticsCount,
      activeOptics,
      clientCount,
      orderCount,
      smsCount,
      telegramCount,
    ] = await Promise.all([
      this.prisma.optics.count(),
      this.prisma.optics.count({ where: { active: true } }),
      this.prisma.client.count(),
      this.prisma.order.count(),
      this.prisma.notification.count({
        where: { channel: 'sms', status: { in: ['sent', 'mocked'] } },
      }),
      this.prisma.notification.count({
        where: { channel: 'telegram', status: 'sent' },
      }),
    ]);

    const byStatus = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return {
      opticsCount,
      activeOptics,
      clientCount,
      orderCount,
      smsCount,
      telegramCount,
      ordersByStatus: Object.fromEntries(
        byStatus.map((row) => [row.status, row._count.status]),
      ),
    };
  }

  async listOptics() {
    const shops = await this.prisma.optics.findMany({
      orderBy: { createdAt: 'desc' },
      include: opticsInclude,
    });

    const sms = await this.prisma.notification.groupBy({
      by: ['opticsId'],
      where: { channel: 'sms', status: { in: ['sent', 'mocked'] } },
      _count: { id: true },
    });
    const telegram = await this.prisma.notification.groupBy({
      by: ['opticsId'],
      where: { channel: 'telegram', status: 'sent' },
      _count: { id: true },
    });
    const smsMap = Object.fromEntries(
      sms.map((row) => [row.opticsId, row._count.id]),
    );
    const tgMap = Object.fromEntries(
      telegram.map((row) => [row.opticsId, row._count.id]),
    );

    return shops.map((shop) => ({
      ...shop,
      username: shop.users[0]?.username ?? null,
      smsCount: smsMap[shop.id] ?? 0,
      telegramCount: tgMap[shop.id] ?? 0,
    }));
  }

  async getOptics(id: string) {
    const shop = await this.prisma.optics.findUnique({
      where: { id },
      include: opticsInclude,
    });
    if (!shop) {
      throw new NotFoundException('Салон не найден');
    }
    const [smsCount, telegramCount, failedTelegram, ordersByStatus] =
      await Promise.all([
        this.prisma.notification.count({
          where: {
            opticsId: id,
            channel: 'sms',
            status: { in: ['sent', 'mocked'] },
          },
        }),
        this.prisma.notification.count({
          where: { opticsId: id, channel: 'telegram', status: 'sent' },
        }),
        this.prisma.notification.count({
          where: { opticsId: id, channel: 'telegram', status: 'failed' },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: { opticsId: id },
          _count: { status: true },
        }),
      ]);

    return {
      ...shop,
      username: shop.users[0]?.username ?? null,
      smsCount,
      telegramCount,
      failedTelegram,
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((row) => [row.status, row._count.status]),
      ),
    };
  }

  async createOptics(dto: CreateOpticsDto) {
    const username = dto.username.trim().toLowerCase();
    const taken = await this.prisma.user.findUnique({ where: { username } });
    if (taken) {
      throw new ConflictException('Такой логин уже занят');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const tpl = await this.messageTemplates.defaultRow();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const modes = normalizeOrderModes(dto.catalogOrders, dto.rxOrders);
        const org = await tx.organization.create({
          data: { name: dto.name.trim() },
        });
        const optics = await tx.optics.create({
          data: {
            organizationId: org.id,
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
            organizationId: org.id,
            isOwner: true,
            orgOwner: true,
          },
        });
        await tx.smsWallet.create({
          data: { organizationId: org.id, balance: 0 },
        });
        await tx.settings.create({
          data: {
            opticsId: optics.id,
            opticsName: dto.name.trim(),
            address: 'укажите адрес в настройках',
            landmark: 'укажите ориентир в настройках',
            template: tpl?.bodyRu || DEFAULT_TEMPLATE,
            templateKey: tpl?.id || 'tpl_compact',
            templateId: tpl?.id,
            messageLang: 'ru',
          },
        });
        return tx.optics.findUniqueOrThrow({
          where: { id: optics.id },
          include: opticsInclude,
        });
      });
      const plan =
        (dto.planId
          ? await this.prisma.plan.findFirst({
              where: { id: dto.planId, isActive: true },
            })
          : null) ||
        (await this.prisma.plan.findFirst({
          where: { slug: 'standard', isActive: true },
        })) ||
        (await this.prisma.plan.findFirst({
          where: { isActive: true },
          orderBy: { price: 'asc' },
        }));
      if (plan) {
        await this.subscriptions.assignPlan(created.organizationId, plan.id);
      }
      return created;
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

  async updateOptics(id: string, dto: UpdateOpticsDto) {
    const current = await this.ensureOptics(id);
    const nextCatalog =
      typeof dto.catalogOrders === 'boolean'
        ? dto.catalogOrders
        : current.catalogOrders;
    const nextRx =
      typeof dto.rxOrders === 'boolean' ? dto.rxOrders : current.rxOrders;
    if (!nextCatalog && !nextRx) {
      throw new BadRequestException(
        'Оставьте хотя бы одну версию заказа: каталог или рецепт',
      );
    }
    await this.prisma.optics.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(typeof dto.active === 'boolean' ? { active: dto.active } : {}),
        ...(typeof dto.staffLimit === 'number' ? { staffLimit: dto.staffLimit } : {}),
        ...(typeof dto.catalogOrders === 'boolean'
          ? { catalogOrders: dto.catalogOrders }
          : {}),
        ...(typeof dto.rxOrders === 'boolean' ? { rxOrders: dto.rxOrders } : {}),
      },
      include: opticsInclude,
    });
    if (dto.name || dto.template || dto.templateKey || dto.resetTemplate) {
      const data: Prisma.SettingsUncheckedUpdateManyInput = {};
      if (dto.name) data.opticsName = dto.name.trim();
      if (dto.resetTemplate) {
        const resetTpl = await this.messageTemplates.defaultRow();
        data.template = resetTpl?.bodyRu || DEFAULT_TEMPLATE;
        data.templateKey = resetTpl?.id || 'tpl_compact';
        if (resetTpl?.id) data.templateId = resetTpl.id;
        data.templateCustom = false;
      } else if (dto.template) {
        data.template = dto.template.trim();
        data.templateKey = dto.templateKey || matchTemplateKey(dto.template);
        data.templateCustom = true;
      }
      await this.prisma.settings.updateMany({
        where: { opticsId: id },
        data,
      });
    }
    return this.getOptics(id);
  }

  async resetPassword(id: string, password: string, username?: string) {
    const optics = await this.ensureOptics(id);
    let user = await this.prisma.user.findFirst({
      where: { opticsId: id, role: 'optics', isOwner: true },
    });
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { opticsId: id, role: 'optics' },
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    if (!user) {
      const login = username?.trim().toLowerCase();
      if (!login) {
        throw new ConflictException('У салона нет логина — укажите его');
      }
      const taken = await this.prisma.user.findUnique({ where: { username: login } });
      if (taken) {
        throw new ConflictException('Такой логин уже занят');
      }
      await this.prisma.user.create({
        data: {
          username: login,
          passwordHash,
          role: 'optics',
          opticsId: id,
          organizationId: optics.organizationId,
          isOwner: true,
        },
      });
      return { ok: true };
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  private async ensureOptics(id: string) {
    const optics = await this.prisma.optics.findUnique({ where: { id } });
    if (!optics) {
      throw new NotFoundException('Салон не найден');
    }
    return optics;
  }
}
