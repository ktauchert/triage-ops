import { SyncStatus, prisma } from "@gridnull/db";
import type { SyncJobPayload } from "@gridnull/shared-types";
import { createSyncQueue } from "../queues/sync-queue.js";

export async function enqueueProjectSyncIfIdle(
  projectId: string,
): Promise<boolean> {
  const activeRun = await prisma.syncRun.findFirst({
    where: {
      projectId,
      status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] },
    },
  });

  if (activeRun) {
    return false;
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      projectId,
      status: SyncStatus.PENDING,
    },
  });

  const queue = createSyncQueue();
  const payload: SyncJobPayload = { projectId, syncRunId: syncRun.id };
  await queue.add("sync", payload);
  return true;
}

export async function runAutoSyncTick(): Promise<number> {
  const projects = await prisma.project.findMany({
    where: { autoSyncEnabled: true },
    select: {
      id: true,
      autoSyncIntervalMinutes: true,
      lastSyncedAt: true,
    },
  });

  const now = Date.now();
  let enqueued = 0;

  for (const project of projects) {
    const intervalMs = Math.max(project.autoSyncIntervalMinutes, 15) * 60_000;
    const lastSyncMs = project.lastSyncedAt?.getTime() ?? 0;

    if (now - lastSyncMs < intervalMs) {
      continue;
    }

    const queued = await enqueueProjectSyncIfIdle(project.id);
    if (queued) {
      enqueued += 1;
    }
  }

  return enqueued;
}
