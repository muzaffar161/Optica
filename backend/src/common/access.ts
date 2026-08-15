import type { AccessLevel } from '@prisma/client';

export const MODULES = [
  'orders',
  'products',
  'clients',
  'journal',
  'settings',
] as const;

export type ModuleKey = (typeof MODULES)[number];

const RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  all: 3,
};

export function hasAccess(level: AccessLevel, min: AccessLevel) {
  return RANK[level] >= RANK[min];
}

export function ownerAccess(): Record<ModuleKey, AccessLevel> {
  return {
    orders: 'all',
    products: 'all',
    clients: 'all',
    journal: 'all',
    settings: 'all',
  };
}
