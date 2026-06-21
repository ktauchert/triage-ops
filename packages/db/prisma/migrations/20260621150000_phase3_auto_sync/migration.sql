-- AlterTable
ALTER TABLE "projects" ADD COLUMN "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN "autoSyncIntervalMinutes" INTEGER NOT NULL DEFAULT 60;
