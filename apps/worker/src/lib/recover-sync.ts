import { IssueSuggestionStatus, SyncStatus, prisma } from "@triage-ops/db";
import { forceReleaseLock } from "./lock.js";
import { getRedis } from "./redis.js";

const INTERRUPTED_SYNC_MESSAGE =
  "Sync interrupted (worker restarted or stopped).";
const INTERRUPTED_APPLY_MESSAGE =
  "Write-back interrupted (worker restarted or stopped).";

/**
 * Clear stale sync runs and in-flight write-backs after a worker crash or
 * restart. Mirrors `recoverInterruptedLlmRuns`: marks PENDING/RUNNING
 * `SyncRun`s FAILED, resets `APPLYING` suggestions to `APPLY_FAILED`, and
 * force-releases the shared `sync:{projectId}` lock so new jobs can proceed.
 */
export async function recoverInterruptedSyncRuns(): Promise<number> {
  const staleRuns = await prisma.syncRun.findMany({
    where: { status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] } },
    select: { id: true, projectId: true },
  });

  const staleApplying = await prisma.issueSuggestion.findMany({
    where: { status: IssueSuggestionStatus.APPLYING },
    select: { id: true, projectId: true },
  });

  if (staleRuns.length === 0 && staleApplying.length === 0) {
    return 0;
  }

  const redis = getRedis();
  const now = new Date();

  const projectIds = new Set<string>([
    ...staleRuns.map((run) => run.projectId),
    ...staleApplying.map((suggestion) => suggestion.projectId),
  ]);

  for (const projectId of projectIds) {
    await forceReleaseLock(redis, `sync:${projectId}`);
  }

  if (staleRuns.length > 0) {
    await prisma.syncRun.updateMany({
      where: { id: { in: staleRuns.map((run) => run.id) } },
      data: {
        status: SyncStatus.FAILED,
        completedAt: now,
        errorMessage: INTERRUPTED_SYNC_MESSAGE,
      },
    });
  }

  if (staleApplying.length > 0) {
    await prisma.issueSuggestion.updateMany({
      where: { id: { in: staleApplying.map((suggestion) => suggestion.id) } },
      data: {
        status: IssueSuggestionStatus.APPLY_FAILED,
        writeBackError: INTERRUPTED_APPLY_MESSAGE,
      },
    });
  }

  return staleRuns.length + staleApplying.length;
}
