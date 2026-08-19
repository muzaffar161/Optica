import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { SubscriptionService } from '../billing/subscription.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { clampStaffPerms, featuresOf } from '../common/plan-features';
import { normalizeOrderModes } from '../common/optics-features';
import { DEFAULT_TEMPLATE } from '../common/template';
import type { AuthUser } from '../common/auth-user';
import { organizationIdOf } from '../common/optics-scope';

const publicUser = {
  id: true,
  username: true,
  isOwner: true,
  orgOwner: true,
  active: true,
  opticsId: true,
  permOrders: true,
  permProducts: true,
  permClients: true,
  permJournal: true,
  permSettings: true,
  createdAt: true,
} as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly events: EventEmitter2,
  ) {}

  async list(actor: AuthUser) {
    const organizationId = organizationIdOf(actor);
    const [shops, plan, employeeCount] = await Promise.all([
      this.prisma.optics.findMany({
        where: actor.orgOwner
          ? { organizationId }
          : { id: actor.opticsId || '', organizationId },
        orderBy: { createdAt: 'asc' },
        include: {
          users: {
            where: { role: 'optics' },
            select: publicUser,
            orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
          },
          _count: { select: { orders: true, clients: true } },
        },
      }),
      this.subscriptions.getCurrentPlan(organizationId),
      this.subscriptions.employeeCount(organizationId),
    ]);
    return {
      branches: shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        active: shop.active,
        catalogOrders: shop.catalogOrders,
        rxOrders: shop.rxOrders,
        current: shop.id === actor.opticsId,
        orderCount: shop._count.orders,
        clientCount: shop._count.clients,
        users: shop.users,
      })),
      staffLimit: plan?.maxEmployees ?? 0,
      networkEmployeeCount: employeeCount,
      unlimited: !!plan && plan.maxEmployees <= 0,
      salonCount: shops.length,
      maxSalons: plan?.maxSalons ?? 1,
      canManageNetwork: !!actor.orgOwner,
    };
  }

  async createBranch(actor: AuthUser, dto: CreateBranchDto) {
    this.ensureOrgOwner(actor);
    const organizationId = organizationIdOf(actor);
    await this.subscriptions.assertCanCreateSalon(organizationId);
    const modes = normalizeOrderModes(dto.catalogOrders, dto.rxOrders);
    const config = await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultTemplate: '' },
      update: {},
    });
    const optics = await this.prisma.$transaction(async (tx) => {
      const shop = await tx.optics.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          catalogOrders: modes.catalogOrders,
          rxOrders: modes.rxOrders,
        },
      });
        const tpl = await tx.messageTemplate.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        await tx.settings.create({
          data: {
            opticsId: shop.id,
            opticsName: dto.name.trim(),
            address: 'укажите адрес в настройках',
            landmark: 'укажите ориентир в настройках',
            template: tpl?.bodyRu || config.defaultTemplate || DEFAULT_TEMPLATE,
            templateKey: tpl?.id || config.defaultTemplateKey,
            templateId: tpl?.id,
            messageLang: 'ru',
          },
        });
      return shop;
    });
    this.events.emit('audit.log', {
      organizationId,
      opticsId: optics.id,
      userId: actor.sub,
      username: actor.username,
      action: 'branch.create',
      entity: 'optics',
      entityId: optics.id,
      summary: `Филиал «${optics.name}»`,
    });
    return optics;
  }

  async updateBranch(actor: AuthUser, id: string, dto: UpdateBranchDto) {
    const shop = await this.branchOfOrg(actor, id);
    if (!actor.orgOwner && shop.id !== actor.opticsId) {
      throw new ForbiddenException('Этот филиал вам недоступен');
    }
    const nextCatalog =
      typeof dto.catalogOrders === 'boolean' ? dto.catalogOrders : shop.catalogOrders;
    const nextRx = typeof dto.rxOrders === 'boolean' ? dto.rxOrders : shop.rxOrders;
    if (!nextCatalog && !nextRx) {
      throw new BadRequestException('Оставьте каталог или рецепт');
    }
    const updated = await this.prisma.optics.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(typeof dto.active === 'boolean' ? { active: dto.active } : {}),
        ...(typeof dto.catalogOrders === 'boolean' ? { catalogOrders: dto.catalogOrders } : {}),
        ...(typeof dto.rxOrders === 'boolean' ? { rxOrders: dto.rxOrders } : {}),
      },
    });
    if (dto.name) {
      await this.prisma.settings.updateMany({
        where: { opticsId: id },
        data: { opticsName: dto.name.trim() },
      });
    }
    this.events.emit('audit.log', {
      organizationId: shop.organizationId,
      opticsId: id,
      userId: actor.sub,
      username: actor.username,
      action: 'branch.update',
      entity: 'optics',
      entityId: id,
      summary: `Филиал «${updated.name}»`,
    });
    return updated;
  }

  async removeBranch(actor: AuthUser, id: string) {
    this.ensureOrgOwner(actor);
    const shop = await this.branchOfOrg(actor, id);
    if (shop.id === actor.opticsId) {
      throw new BadRequestException('Нельзя удалить филиал, в котором вы сейчас вошли');
    }
    const [salonCount, orders, clients, staff] = await Promise.all([
      this.prisma.optics.count({ where: { organizationId: shop.organizationId } }),
      this.prisma.order.count({ where: { opticsId: id } }),
      this.prisma.client.count({ where: { opticsId: id } }),
      this.prisma.user.count({
        where: { opticsId: id, role: 'optics', isOwner: false },
      }),
    ]);
    if (salonCount <= 1) {
      throw new BadRequestException('Последний филиал удалить нельзя');
    }
    if (orders > 0 || clients > 0) {
      throw new BadRequestException(
        'В филиале есть заказы или клиенты. Перенесите их или просто выключите филиал.',
      );
    }
    if (staff > 0) {
      throw new BadRequestException('Сначала переместите или удалите сотрудников');
    }
    await this.prisma.optics.delete({ where: { id } });
    this.events.emit('audit.log', {
      organizationId: shop.organizationId,
      userId: actor.sub,
      username: actor.username,
      action: 'branch.delete',
      entity: 'optics',
      entityId: id,
      summary: `Удалён филиал «${shop.name}»`,
    });
    return { ok: true };
  }

  async create(actor: AuthUser, dto: CreateStaffDto) {
    const opticsId = await this.targetOptics(actor, dto.opticsId);
    const optics = await this.prisma.optics.findUniqueOrThrow({
      where: { id: opticsId },
      select: { organizationId: true },
    });
    await this.subscriptions.assertCanCreateEmployee(optics.organizationId);
    const plan = await this.subscriptions.getCurrentPlan(optics.organizationId);
    const perms = clampStaffPerms(featuresOf(plan), dto);
    const username = dto.username.trim().toLowerCase();
    const taken = await this.prisma.user.findUnique({ where: { username } });
    if (taken) {
      throw new ConflictException('Такой логин уже занят');
    }
    const created = await this.prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: 'optics',
        opticsId,
        organizationId: optics.organizationId,
        isOwner: false,
        permOrders: perms.permOrders,
        permProducts: perms.permProducts,
        permClients: perms.permClients,
        permJournal: perms.permJournal,
        permSettings: perms.permSettings,
      },
      select: publicUser,
    });
    this.events.emit('audit.log', {
      organizationId: optics.organizationId,
      opticsId,
      userId: actor.sub,
      username: actor.username,
      action: 'staff.create',
      entity: 'user',
      entityId: created.id,
      summary: `Сотрудник ${created.username}`,
    });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateStaffDto) {
    const user = await this.ensureStaff(actor, id);
    if (user.orgOwner) {
      throw new ForbiddenException('Владельца сети менять здесь нельзя');
    }
    if (user.isOwner && !actor.orgOwner) {
      throw new ForbiddenException('Права владельца филиала менять нельзя');
    }
    const optics = await this.prisma.optics.findUniqueOrThrow({
      where: { id: user.opticsId! },
      select: { organizationId: true },
    });
    const plan = await this.subscriptions.getCurrentPlan(optics.organizationId);
    const perms = clampStaffPerms(featuresOf(plan), dto);
    const data: Prisma.UserUpdateInput = {
      ...(typeof dto.active === 'boolean' ? { active: dto.active } : {}),
      ...(perms.permOrders ? { permOrders: perms.permOrders } : {}),
      ...(perms.permProducts ? { permProducts: perms.permProducts } : {}),
      ...(perms.permClients ? { permClients: perms.permClients } : {}),
      ...(perms.permJournal ? { permJournal: perms.permJournal } : {}),
      ...(perms.permSettings ? { permSettings: perms.permSettings } : {}),
    };
    if (dto.username) {
      const username = dto.username.trim().toLowerCase();
      const taken = await this.prisma.user.findUnique({ where: { username } });
      if (taken && taken.id !== id) {
        throw new ConflictException('Такой логин уже занят');
      }
      data.username = username;
    }
    if (dto.opticsId && dto.opticsId !== user.opticsId) {
      if (!actor.orgOwner) {
        throw new ForbiddenException('Переносить сотрудников может владелец сети');
      }
      if (user.orgOwner) {
        throw new ForbiddenException('Владельца сети перенести нельзя');
      }
      const dest = await this.branchOfOrg(actor, dto.opticsId);
      data.optics = { connect: { id: dest.id } };
      if (user.isOwner) data.isOwner = false;
    }
    return this.prisma.user
      .update({
        where: { id },
        data,
        select: publicUser,
      })
      .then((row) => {
        this.events.emit('audit.log', {
          organizationId: optics.organizationId,
          opticsId: row.opticsId,
          userId: actor.sub,
          username: actor.username,
          action: dto.opticsId && dto.opticsId !== user.opticsId ? 'staff.move' : 'staff.update',
          entity: 'user',
          entityId: id,
          summary:
            dto.opticsId && dto.opticsId !== user.opticsId
              ? `${row.username} переведён в другой филиал`
              : `Сотрудник ${row.username}`,
        });
        return row;
      });
  }

  async resetPassword(actor: AuthUser, id: string, password: string) {
    const user = await this.ensureStaff(actor, id);
    if (user.orgOwner || (user.isOwner && !actor.orgOwner)) {
      throw new ForbiddenException('Пароль владельца сбрасывается в поддержке');
    }
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
      select: publicUser,
    });
  }

  async remove(actor: AuthUser, id: string) {
    const user = await this.ensureStaff(actor, id);
    if (user.orgOwner || user.isOwner) {
      throw new ForbiddenException('Владельца удалить нельзя');
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  private ensureOrgOwner(user: AuthUser) {
    if (!user.orgOwner) {
      throw new ForbiddenException('Филиалы сети создаёт владелец организации');
    }
  }

  private async targetOptics(actor: AuthUser, opticsId?: string) {
    const id = opticsId || actor.opticsId;
    if (!id) throw new BadRequestException('Укажите филиал');
    const shop = await this.branchOfOrg(actor, id);
    if (!actor.orgOwner && shop.id !== actor.opticsId) {
      throw new ForbiddenException('Можно добавлять только в свой филиал');
    }
    return shop.id;
  }

  private async branchOfOrg(actor: AuthUser, id: string) {
    const shop = await this.prisma.optics.findFirst({
      where: { id, organizationId: organizationIdOf(actor) },
    });
    if (!shop) throw new NotFoundException('Филиал не найден');
    return shop;
  }

  private async ensureStaff(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findFirst({
      where: actor.orgOwner
        ? { id, organizationId: organizationIdOf(actor), role: 'optics' }
        : { id, opticsId: actor.opticsId || undefined, role: 'optics' },
    });
    if (!user) throw new NotFoundException('Сотрудник не найден');
    return user;
  }
}
