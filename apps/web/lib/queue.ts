import { Queue, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, type SyncJobPayload } from "@triage-ops/shared-types";

let syncQueue: Queue<SyncJobPayload> | null = null;

function getQueueConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }

  return {
    url: redisUrl,
    maxRetriesPerRequest: null,
  };
}

export function getSyncQueue(): Queue<SyncJobPayload> {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobPayload>(QUEUE_NAMES.GITLAB_SYNC, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  return syncQueue;
}

export async function enqueueSyncJob(payload: SyncJobPayload): Promise<void> {
  const queue = getSyncQueue();
  await queue.add("sync", payload);
}
