-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "statsLevel" TEXT NOT NULL DEFAULT 'basic';
ALTER TABLE "Plan" ADD COLUMN "auditLevel" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Plan" ADD COLUMN "canExport" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "advancedRoles" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "apiAccess" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "prioritySupport" BOOLEAN NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "opticsId" TEXT,
    "userId" TEXT,
    "username" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_opticsId_idx" ON "AuditEvent"("opticsId");

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
