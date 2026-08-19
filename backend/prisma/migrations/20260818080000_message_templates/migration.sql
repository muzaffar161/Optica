-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hint" TEXT NOT NULL DEFAULT '',
    "bodyRu" TEXT NOT NULL,
    "bodyUz" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "messageLang" TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE "Settings" ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE INDEX "Settings_templateId_idx" ON "Settings"("templateId");
