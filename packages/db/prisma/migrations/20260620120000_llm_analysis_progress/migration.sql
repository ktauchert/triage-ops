-- AlterTable
ALTER TABLE "llm_analysis_runs" ADD COLUMN "totalSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "llm_analysis_runs" ADD COLUMN "completedSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "llm_analysis_runs" ADD COLUMN "progressLabel" TEXT;
