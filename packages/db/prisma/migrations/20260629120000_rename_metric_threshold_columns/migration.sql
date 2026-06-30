-- Rename ghost/zombie threshold columns to stale/stuck (Gridnull metric rename).
ALTER TABLE "projects" RENAME COLUMN "ghostThresholdDays" TO "staleThresholdDays";
ALTER TABLE "projects" RENAME COLUMN "zombieThresholdDays" TO "stuckThresholdDays";
