-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "opticsId" TEXT,
    "organizationId" TEXT,
    "userId" TEXT,
    "role" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL DEFAULT '',
    "ms" INTEGER,
    "meta" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_name_createdAt_idx" ON "UsageEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_opticsId_createdAt_idx" ON "UsageEvent"("opticsId", "createdAt");
