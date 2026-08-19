import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RATE_LIMIT_KEY, type RateLimitBy, type RateLimitRule } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';
import type { AuthUser } from './auth-user';

const GLOBAL: RateLimitRule = {
  name: 'global',
  limit: 120,
  windowMs: 60_000,
  by: 'ip+user',
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<
      Request & { user?: AuthUser; apiOrganizationId?: string }
    >();
    const extra =
      this.reflector.getAllAndOverride<RateLimitRule[]>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    for (const rule of [GLOBAL, ...extra]) {
      const id = this.keyPart(req, rule.by ?? 'ip');
      this.limiter.consume(`${rule.name}:${id}`, rule.limit, rule.windowMs);
    }
    return true;
  }

  private keyPart(
    req: Request & { user?: AuthUser; apiOrganizationId?: string },
    by: RateLimitBy,
  ) {
    const ip = clientIp(req);
    const user = req.user?.sub;
    if (by === 'user') return user || ip;
    if (by === 'ip+user') return user ? `u:${user}` : `ip:${ip}`;
    if (by === 'ip+login') {
      const login =
        typeof req.body?.username === 'string'
          ? req.body.username.trim().toLowerCase()
          : '';
      return `${ip}:${login || '-'}`;
    }
    if (by === 'param:id') return String(req.params?.id || ip);
    if (by === 'optics') return req.user?.opticsId || user || ip;
    if (by === 'org') return req.user?.organizationId || user || ip;
    if (by === 'apiKey') {
      const header = req.headers['x-api-key'];
      const raw = Array.isArray(header) ? header[0] : header;
      return raw?.slice(0, 24) || `ip:${ip}`;
    }
    return ip;
  }
}

function clientIp(req: Request) {
  const xf = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(xf) ? xf[0] : xf?.split(',')[0];
  return (forwarded || req.ip || req.socket.remoteAddress || 'unknown').trim();
}
