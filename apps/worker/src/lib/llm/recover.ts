import { SyncStatus, prisma } from "@triage-ops/db";
import { forceReleaseLock } from "../lock.js";
import { getRedis } from "../redis.js";

const INTERRUPTED_MESSAGE =
  "Analysis interrupted (worker restarted or stopped).";

/** Clear stale PENDING/RUNNING runs after Ctrl+C or worker crash. */
export async function recoverInterruptedLlmRuns(): Promise<number> {
  const staleRuns = await prisma.llmAnalysisRun.findMany({
    where: { status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] } },
    select: { id: true, projectId: true },
  });

  if (staleRuns.length === 0) {
    return 0;
  }

  const redis = getRedis();
  const now = new Date();

  for (const run of staleRuns) {
    await forceReleaseLock(redis, `llm:${run.projectId}`);
  }

  await prisma.llmAnalysisRun.updateMany({
    where: { id: { in: staleRuns.map((run) => run.id) } },
    data: {
      status: SyncStatus.FAILED,
      completedAt: now,
      errorMessage: INTERRUPTED_MESSAGE,
      progressLabel: "Interrupted",
    },
  });

  return staleRuns.length;
}
