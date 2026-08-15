-- AlterTable
ALTER TABLE "Client" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "unarchivedAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "unarchivedAt" DATETIME;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "unarchivedAt" DATETIME;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "hours" TEXT NOT NULL DEFAULT '9:00–20:00';
ALTER TABLE "Settings" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'atelier';
ALTER TABLE "Settings" ADD COLUMN "archiveAfterDays" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Settings" ADD COLUMN "templateKey" TEXT NOT NULL DEFAULT 'compact';

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "defaultTemplateKey" TEXT NOT NULL DEFAULT 'compact';
