-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "adminAlertPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" DROP COLUMN "adminTelegramChatId";
