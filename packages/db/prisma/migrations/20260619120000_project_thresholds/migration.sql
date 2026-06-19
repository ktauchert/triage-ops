-- AlterTable
ALTER TABLE "projects" ADD COLUMN "ghostThresholdDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "projects" ADD COLUMN "zombieThresholdDays" INTEGER NOT NULL DEFAULT 14;
