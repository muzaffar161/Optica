export const DEFAULT_ARCHIVE_DAYS = 10;

export function clampArchiveDays(days?: number | null) {
  if (!days || !Number.isFinite(days)) return DEFAULT_ARCHIVE_DAYS;
  return Math.min(365, Math.max(1, Math.round(days)));
}

export function archiveCutoff(days?: number | null, now = new Date()) {
  return new Date(
    now.getTime() - clampArchiveDays(days) * 24 * 60 * 60 * 1000,
  );
}

export function currentArchiveWhere(cutoff: Date) {
  return {
    archived: false,
    OR: [{ createdAt: { gte: cutoff } }, { unarchivedAt: { gte: cutoff } }],
  };
}

export function archivedWhere(cutoff: Date) {
  return {
    OR: [
      { archived: true },
      {
        createdAt: { lt: cutoff },
        OR: [{ unarchivedAt: null }, { unarchivedAt: { lt: cutoff } }],
      },
    ],
  };
}

export function isArchivedRow(
  row: { archived: boolean; createdAt: Date; unarchivedAt?: Date | null },
  cutoff: Date,
) {
  if (row.archived) return true;
  if (row.createdAt >= cutoff) return false;
  if (row.unarchivedAt && row.unarchivedAt >= cutoff) return false;
  return true;
}

export function archiveData(archived: boolean) {
  return archived
    ? { archived: true }
    : { archived: false, unarchivedAt: new Date() };
}
