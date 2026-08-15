-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "clickInstructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" ADD COLUMN "clickQrPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" ADD COLUMN "clickAccount" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" ADD COLUMN "cardInstructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" ADD COLUMN "cardNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" ADD COLUMN "cardOwner" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlatformConfig" ADD COLUMN "paymentExpireHours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "planId" TEXT,
    "smsPackageId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payerName" TEXT,
    "cardLast4" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "rejectedAt" DATETIME,
    "expiresAt" DATETIME,
    "confirmedBy" TEXT,
    "rejectionReason" TEXT,
    CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_smsPackageId_fkey" FOREIGN KEY ("smsPackageId") REFERENCES "SmsPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE INDEX "Payment_organizationId_createdAt_idx" ON "Payment"("organizationId", "createdAt");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
