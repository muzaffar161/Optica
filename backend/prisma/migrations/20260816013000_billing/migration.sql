PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Organization" ("id", "name", "active", "createdAt", "updatedAt")
SELECT "id", "name", "active", "createdAt", "updatedAt" FROM "Optics";

-- RedefineTable
CREATE TABLE "new_Optics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "staffLimit" INTEGER NOT NULL DEFAULT 5,
    "catalogOrders" BOOLEAN NOT NULL DEFAULT true,
    "rxOrders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Optics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Optics" ("id", "organizationId", "name", "active", "staffLimit", "catalogOrders", "rxOrders", "createdAt", "updatedAt")
SELECT "id", "id", "name", "active", "staffLimit", "catalogOrders", "rxOrders", "createdAt", "updatedAt" FROM "Optics";
DROP TABLE "Optics";
ALTER TABLE "new_Optics" RENAME TO "Optics";

-- AlterTable User
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "opticsId" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "orgOwner" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "permOrders" TEXT NOT NULL DEFAULT 'all',
    "permProducts" TEXT NOT NULL DEFAULT 'all',
    "permClients" TEXT NOT NULL DEFAULT 'all',
    "permJournal" TEXT NOT NULL DEFAULT 'all',
    "permSettings" TEXT NOT NULL DEFAULT 'all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    CONSTRAINT "User_opticsId_fkey" FOREIGN KEY ("opticsId") REFERENCES "Optics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("id", "username", "passwordHash", "role", "opticsId", "isOwner", "orgOwner", "active", "permOrders", "permProducts", "permClients", "permJournal", "permSettings", "createdAt", "organizationId")
SELECT "id", "username", "passwordHash", "role", "opticsId", "isOwner", CASE WHEN "isOwner" = 1 THEN 1 ELSE 0 END, "active", "permOrders", "permProducts", "permClients", "permJournal", "permSettings", "createdAt", "opticsId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateTable Plan
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "billingPeriod" TEXT NOT NULL DEFAULT 'month',
    "maxSalons" INTEGER NOT NULL,
    "maxEmployees" INTEGER NOT NULL,
    "includedSms" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateTable Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Subscription_organizationId_status_idx" ON "Subscription"("organizationId", "status");

-- CreateTable SmsWallet
CREATE TABLE "SmsWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SmsWallet_organizationId_key" ON "SmsWallet"("organizationId");

-- CreateTable SmsTransaction
CREATE TABLE "SmsTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notificationId" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmsTransaction_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SmsTransaction_organizationId_idx" ON "SmsTransaction"("organizationId");

-- CreateTable SmsPackage
CREATE TABLE "SmsPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "smsCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=ON;
