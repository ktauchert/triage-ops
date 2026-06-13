import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, type SyncJobPayload } from "@triage-ops/shared-types";
import { getEnv } from "../config/env.js";

export function getQueueConnection(): ConnectionOptions {
  return {
    url: getEnv("REDIS_URL"),
    maxRetriesPerRequest: null,
  };
}

export function createSyncQueue(): Queue<SyncJobPayload> {
  return new Queue<SyncJobPayload>(QUEUE_NAMES.GITLAB_SYNC, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

export { Worker };
