-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "checkupRemindEnabled" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ADD COLUMN "checkupIntervalMonths" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Settings" ADD COLUMN "checkupNotifyDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ADD COLUMN "lastCheckupRunOn" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "lastVisitAt" DATETIME;
ALTER TABLE "Client" ADD COLUMN "lastCheckupRemindedAt" DATETIME;

CREATE INDEX "Client_opticsId_lastVisitAt_idx" ON "Client"("opticsId", "lastVisitAt");

UPDATE "Client" SET "lastVisitAt" = (
  SELECT MAX("createdAt") FROM "Order" WHERE "Order"."clientId" = "Client"."id"
);

ALTER TABLE "Notification" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'order';
