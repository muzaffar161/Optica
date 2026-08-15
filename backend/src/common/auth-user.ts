import type { AccessLevel, Role } from '@prisma/client';
import type { ModuleKey } from './access';

export type AuthUser = {
  sub: string;
  username: string;
  role: Role;
  opticsId: string | null;
  organizationId: string | null;
  isOwner: boolean;
  orgOwner: boolean;
  access: Record<ModuleKey, AccessLevel>;
};
