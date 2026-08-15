import { ForbiddenException } from '@nestjs/common';

export type StatsLevel = 'basic' | 'extended' | 'network';
export type AuditLevel = 'none' | 'salon' | 'extended';

export type PlanFeatures = {
  statsLevel: StatsLevel;
  auditLevel: AuditLevel;
  canExport: boolean;
  advancedRoles: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
};

export const DEFAULT_FEATURES: PlanFeatures = {
  statsLevel: 'basic',
  auditLevel: 'none',
  canExport: false,
  advancedRoles: false,
  apiAccess: false,
  prioritySupport: false,
};

type PlanLike = {
  statsLevel?: string | null;
  auditLevel?: string | null;
  canExport?: boolean | null;
  advancedRoles?: boolean | null;
  apiAccess?: boolean | null;
  prioritySupport?: boolean | null;
} | null | undefined;

function asStats(value?: string | null): StatsLevel {
  if (value === 'extended' || value === 'network') return value;
  return 'basic';
}

function asAudit(value?: string | null): AuditLevel {
  if (value === 'salon' || value === 'extended') return value;
  return 'none';
}

export function featuresOf(plan: PlanLike): PlanFeatures {
  if (!plan) return { ...DEFAULT_FEATURES };
  return {
    statsLevel: asStats(plan.statsLevel),
    auditLevel: asAudit(plan.auditLevel),
    canExport: !!plan.canExport,
    advancedRoles: !!plan.advancedRoles,
    apiAccess: !!plan.apiAccess,
    prioritySupport: !!plan.prioritySupport,
  };
}

export function assertExport(features: PlanFeatures) {
  if (!features.canExport) {
    throw new ForbiddenException('Экспорт доступен начиная с тарифа Business');
  }
}

export function assertAudit(features: PlanFeatures) {
  if (features.auditLevel === 'none') {
    throw new ForbiddenException('Журнал действий доступен начиная с тарифа Business');
  }
}

export function assertApi(features: PlanFeatures) {
  if (!features.apiAccess) {
    throw new ForbiddenException('API доступен на тарифе Enterprise');
  }
}

const LEVEL_RANK = { none: 0, view: 1, edit: 2, all: 3 } as const;
type Access = 'none' | 'view' | 'edit' | 'all';

function clampLevel(level: Access | undefined, advanced: boolean): Access | undefined {
  if (!level) return level;
  if (advanced) return level;
  if (level === 'all') return 'edit';
  return level;
}

export function clampStaffPerms<
  T extends {
    permOrders?: Access;
    permProducts?: Access;
    permClients?: Access;
    permJournal?: Access;
    permSettings?: Access;
  },
>(features: PlanFeatures, dto: T): T {
  if (features.advancedRoles) return dto;
  return {
    ...dto,
    permOrders: clampLevel(dto.permOrders, false),
    permProducts: clampLevel(dto.permProducts, false),
    permClients: clampLevel(dto.permClients, false),
    permJournal: clampLevel(dto.permJournal, false),
    permSettings: dto.permSettings != null ? 'none' : dto.permSettings,
  };
}

export function featureList(features: PlanFeatures) {
  return [
    { key: 'stats-basic', label: 'Базовая статистика', on: true },
    { key: 'roles-basic', label: 'Обычные роли сотрудников', on: true },
    { key: 'stats-extended', label: 'Расширенная статистика', on: features.statsLevel !== 'basic' },
    { key: 'audit', label: 'Журнал действий', on: features.auditLevel !== 'none' },
    { key: 'export', label: 'Экспорт данных', on: features.canExport },
    { key: 'roles-advanced', label: 'Гибкие права по разделам', on: features.advancedRoles },
    { key: 'stats-network', label: 'Статистика по всей сети', on: features.statsLevel === 'network' },
    { key: 'reports', label: 'Объединённые отчёты', on: features.statsLevel === 'network' },
    { key: 'audit-ext', label: 'Расширенный audit log', on: features.auditLevel === 'extended' },
    { key: 'api', label: 'API', on: features.apiAccess },
    { key: 'support', label: 'Приоритетная поддержка', on: features.prioritySupport },
  ];
}

export { LEVEL_RANK };
