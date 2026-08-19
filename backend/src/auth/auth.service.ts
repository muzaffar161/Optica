import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ownerAccess } from '../common/access';
import { featuresOf } from '../common/plan-features';
import { EventEmitter2 } from '@nestjs/event-emitter';

const DUMMY_HASH = bcrypt.hashSync('optika-timing-dummy', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventEmitter2,
  ) {}

  async login(username: string, password: string) {
    const login = username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username: login },
      include: { optics: true },
    });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    if (!user.active) {
      throw new UnauthorizedException('Доступ отключён.');
    }
    if (user.role === 'optics' && (!user.optics || !user.optics.active)) {
      throw new UnauthorizedException('Салон отключён. Обратитесь в поддержку.');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
      opticsId: user.opticsId,
    });
    this.events.emit('audit.log', {
      organizationId: user.organizationId ?? user.optics?.organizationId,
      opticsId: user.opticsId,
      userId: user.id,
      username: user.username,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      summary: 'Вход в панель',
    });
    return {
      accessToken,
      username: user.username,
      role: user.role,
      opticsId: user.opticsId,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { optics: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const settings = user.opticsId
      ? await this.prisma.settings.findUnique({
          where: { opticsId: user.opticsId },
          select: { theme: true },
        })
      : null;
    const orgId = user.organizationId ?? user.optics?.organizationId ?? null;
    const sub = orgId
      ? await this.prisma.subscription.findFirst({
          where: { organizationId: orgId, status: 'ACTIVE' },
          include: { plan: true },
          orderBy: { startedAt: 'desc' },
        })
      : null;
    const plan =
      sub && sub.expiresAt.getTime() >= Date.now() ? sub.plan : null;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      opticsId: user.opticsId,
      opticsName: user.optics?.name ?? null,
      organizationId: orgId,
      isOwner: user.isOwner,
      orgOwner: user.orgOwner,
      staffLimit: user.optics?.staffLimit ?? 0,
      catalogOrders: user.optics?.catalogOrders ?? true,
      rxOrders: user.optics?.rxOrders ?? false,
      theme: settings?.theme ?? 'atelier',
      planFeatures: featuresOf(plan),
      access: user.isOwner
        ? ownerAccess()
        : {
            orders: user.permOrders,
            products: user.permProducts,
            clients: user.permClients,
            journal: user.permJournal,
            settings: user.permSettings,
          },
    };
  }
}
