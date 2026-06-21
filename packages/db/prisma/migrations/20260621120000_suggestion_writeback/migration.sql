-- AlterEnum
ALTER TYPE "IssueSuggestionStatus" ADD VALUE 'APPLYING';
ALTER TYPE "IssueSuggestionStatus" ADD VALUE 'APPLY_FAILED';

-- AlterTable
ALTER TABLE "issue_suggestions" ADD COLUMN "writeBackError" TEXT;
