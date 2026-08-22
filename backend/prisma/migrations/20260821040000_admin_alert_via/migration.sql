-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "adminAlertVia" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "PlatformConfig" ADD COLUMN "adminTelegramChatId" TEXT NOT NULL DEFAULT '';
