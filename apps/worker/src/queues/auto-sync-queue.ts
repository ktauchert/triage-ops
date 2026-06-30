import { Queue } from "bullmq";
import {
  QUEUE_NAMES,
  type AutoSyncJobPayload,
} from "@gridnull/shared-types";
import { getOptionalEnv } from "../config/env.js";
import { getQueueConnection } from "./sync-queue.js";

export function createAutoSyncQueue(): Queue<AutoSyncJobPayload> {
  return new Queue<AutoSyncJobPayload>(QUEUE_NAMES.AUTO_SYNC, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  });
}

export async function registerAutoSyncSchedule(): Promise<void> {
  const enabled =
    getOptionalEnv("AUTO_SYNC_SCHEDULER_ENABLED", "false") === "true";

  if (!enabled) {
    console.log("[auto-sync] Scheduler disabled (AUTO_SYNC_SCHEDULER_ENABLED)");
    return;
  }

  const tickMinutes = Math.max(
    parseInt(getOptionalEnv("AUTO_SYNC_TICK_MINUTES", "15"), 10),
    5,
  );

  const queue = createAutoSyncQueue();
  await queue.add(
    "tick",
    { tick: true },
    {
      repeat: { every: tickMinutes * 60_000 },
      jobId: "auto-sync-tick",
    },
  );

  console.log(
    `[auto-sync] Repeatable tick scheduled every ${tickMinutes} minute(s)`,
  );
}
