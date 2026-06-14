-- GitHub global issue IDs exceed 32-bit signed integer range.
ALTER TABLE "issues" ALTER COLUMN "gitlabIssueId" SET DATA TYPE BIGINT;
