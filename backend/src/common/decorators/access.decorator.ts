import { SetMetadata } from '@nestjs/common';
import type { AccessLevel } from '@prisma/client';
import type { ModuleKey } from '../access';

export const ACCESS_KEY = 'access';

export type AccessMeta = {
  module: ModuleKey;
  min: AccessLevel;
};

export const Access = (module: ModuleKey, min: AccessLevel = 'view') =>
  SetMetadata(ACCESS_KEY, { module, min } satisfies AccessMeta);
