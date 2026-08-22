import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/auth-user';
import { SubscriptionService } from './subscription.service';

function routeOf(req: Request) {
  const raw = String(req.originalUrl || req.url || '').split('?')[0];
  return raw.replace(/^\/api/, '') || '/';
}

function allowedWhileExpired(path: string) {
  return (
    path.startsWith('/auth') ||
    path.startsWith('/billing') ||
    path === '/usage' ||
    path.startsWith('/usage/')
  );
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user || user.role !== 'optics') return true;

    const path = routeOf(req);
    if (allowedWhileExpired(path)) return true;

    const orgId = user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('Подписка истекла. Продлите тариф.');
    }
    const plan = await this.subscriptions.getCurrentPlan(orgId);
    if (!plan) {
      throw new ForbiddenException('Подписка истекла. Продлите тариф.');
    }
    return true;
  }
}
