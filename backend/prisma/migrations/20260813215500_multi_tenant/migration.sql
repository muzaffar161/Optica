-- CreateTable
CREATE TABLE "Optics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "opticsId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_opticsId_fkey" FOREIGN KEY ("opticsId") REFERENCES "Optics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

INSERT INTO "User" ("id", "username", "passwordHash", "role", "opticsId", "createdAt")
SELECT "id", "username", "passwordHash", 'platform', NULL, "createdAt" FROM "Admin";

INSERT INTO "Optics" ("id", "name", "active", "createdAt", "updatedAt")
SELECT 'legacy-demo-optics',
  COALESCE((SELECT "opticsName" FROM "Settings" LIMIT 1), 'Оптика'),
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Settings") OR EXISTS (SELECT 1 FROM "Client");

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opticsId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_opticsId_fkey" FOREIGN KEY ("opticsId") REFERENCES "Optics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("id", "opticsId", "fullName", "phone", "telegramChatId", "createdAt", "updatedAt")
SELECT "id", 'legacy-demo-optics', "fullName", "phone", "telegramChatId", "createdAt", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_opticsId_phone_key" ON "Client"("opticsId", "phone");
CREATE INDEX "Client_opticsId_idx" ON "Client"("opticsId");

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opticsId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "clientId" TEXT NOT NULL,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_opticsId_fkey" FOREIGN KEY ("opticsId") REFERENCES "Optics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("id", "opticsId", "title", "status", "clientId", "notifiedAt", "createdAt", "updatedAt")
SELECT "id", 'legacy-demo-optics', "title", "status", "clientId", "notifiedAt", "createdAt", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_opticsId_idx" ON "Order"("opticsId");

CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opticsId" TEXT NOT NULL,
    "opticsName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_opticsId_fkey" FOREIGN KEY ("opticsId") REFERENCES "Optics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("id", "opticsId", "opticsName", "address", "landmark", "template", "updatedAt")
SELECT "id", 'legacy-demo-optics', "opticsName", "address", "landmark", "template", "updatedAt"
FROM "Settings"
WHERE EXISTS (SELECT 1 FROM "Optics" WHERE "id" = 'legacy-demo-optics');
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_opticsId_key" ON "Settings"("opticsId");

CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opticsId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_opticsId_fkey" FOREIGN KEY ("opticsId") REFERENCES "Optics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("id", "opticsId", "orderId", "channel", "status", "message", "error", "createdAt")
SELECT "id", 'legacy-demo-optics', "orderId", "channel", "status", "message", "error", "createdAt" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_opticsId_idx" ON "Notification"("opticsId");

DROP TABLE "Admin";

PRAGMA foreign_keys=ON;
