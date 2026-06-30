-- AlterTable
ALTER TABLE "projects" ADD COLUMN "staleThresholdDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "projects" ADD COLUMN "stuckThresholdDays" INTEGER NOT NULL DEFAULT 14;
