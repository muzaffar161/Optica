-- AlterTable
ALTER TABLE "PlatformSmsTx" ADD COLUMN "kind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformSmsTx" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
CREATE INDEX "PlatformSmsTx_createdAt_idx" ON "PlatformSmsTx"("createdAt");
CREATE INDEX "PlatformSmsTx_kind_idx" ON "PlatformSmsTx"("kind");
CREATE INDEX "PlatformSmsTx_organizationId_idx" ON "PlatformSmsTx"("organizationId");
