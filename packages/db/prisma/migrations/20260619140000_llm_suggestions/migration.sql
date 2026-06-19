-- CreateEnum
CREATE TYPE "IssueSuggestionType" AS ENUM ('DUPLICATE', 'DESCRIPTION');

-- CreateEnum
CREATE TYPE "IssueSuggestionStatus" AS ENUM ('PENDING', 'DISMISSED', 'APPLIED');

-- CreateTable
CREATE TABLE "issue_suggestions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "IssueSuggestionType" NOT NULL,
    "status" "IssueSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "issueId" TEXT NOT NULL,
    "relatedIssueId" TEXT,
    "suggestedText" TEXT,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "issue_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_analysis_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "suggestionsCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "llm_analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_suggestions_projectId_status_idx" ON "issue_suggestions"("projectId", "status");

-- CreateIndex
CREATE INDEX "issue_suggestions_issueId_idx" ON "issue_suggestions"("issueId");

-- CreateIndex
CREATE INDEX "llm_analysis_runs_projectId_startedAt_idx" ON "llm_analysis_runs"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "llm_analysis_runs_status_idx" ON "llm_analysis_runs"("status");

-- AddForeignKey
ALTER TABLE "issue_suggestions" ADD CONSTRAINT "issue_suggestions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_suggestions" ADD CONSTRAINT "issue_suggestions_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_suggestions" ADD CONSTRAINT "issue_suggestions_relatedIssueId_fkey" FOREIGN KEY ("relatedIssueId") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_analysis_runs" ADD CONSTRAINT "llm_analysis_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
