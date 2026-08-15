import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './auth-user';

export function opticsIdOf(user: AuthUser): string {
  if (user.role !== 'optics' || !user.opticsId) {
    throw new ForbiddenException('Этот раздел только для салона');
  }
  return user.opticsId;
}

export function organizationIdOf(user: AuthUser): string {
  if (user.role !== 'optics' || !user.organizationId) {
    throw new ForbiddenException('Этот раздел только для организации');
  }
  return user.organizationId;
}
