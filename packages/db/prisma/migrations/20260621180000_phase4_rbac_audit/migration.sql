-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LEAD', 'OPERATOR', 'VIEWER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'VIEWER';

-- AlterTable
ALTER TABLE "issue_suggestions" ADD COLUMN "appliedByUserId" TEXT,
ADD COLUMN "dismissedByUserId" TEXT;

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_suggestions" ADD CONSTRAINT "issue_suggestions_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_suggestions" ADD CONSTRAINT "issue_suggestions_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
