import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth-user';
import { ownerAccess } from '../common/access';
import { jwtSecret } from '../common/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(config),
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { optics: true },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }
    if (user.role === 'optics' && (!user.opticsId || !user.optics?.active)) {
      throw new UnauthorizedException('Салон отключён');
    }
    return {
      sub: user.id,
      username: user.username,
      role: user.role,
      opticsId: user.opticsId,
      organizationId: user.organizationId ?? user.optics?.organizationId ?? null,
      isOwner: user.isOwner,
      orgOwner: user.orgOwner,
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
