-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "defaultTemplate" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "PlatformConfig" ("id", "defaultTemplate", "updatedAt")
VALUES (
  'default',
  'Здравствуйте, {fullName}! Ваш заказ «{orderTitle}» готов. Можете забрать: {address}, {opticsName}, ориентир: {landmark}.',
  CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "templateCustom" BOOLEAN NOT NULL DEFAULT false;
