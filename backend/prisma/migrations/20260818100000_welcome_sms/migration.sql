-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'salon';
CREATE INDEX "MessageTemplate_kind_idx" ON "MessageTemplate"("kind");

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "smsBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformConfig" ADD COLUMN "botLink" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PlatformSmsTx" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductPhone" (
    "phone" TEXT NOT NULL PRIMARY KEY,
    "welcomedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
