import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_KEY, type AccessMeta } from '../decorators/access.decorator';
import { hasAccess } from '../access';
import type { AuthUser } from '../auth-user';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const meta = this.reflector.getAllAndOverride<AccessMeta>(ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) return false;
    if (user.role === 'platform' || user.isOwner) return true;
    const level = user.access[meta.module];
    if (hasAccess(level, meta.min)) return true;
    throw new ForbiddenException('Недостаточно прав');
  }
}
