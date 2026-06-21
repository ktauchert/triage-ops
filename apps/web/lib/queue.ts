import { Queue, type ConnectionOptions } from "bullmq";
import {
  QUEUE_NAMES,
  type LlmAnalysisJobPayload,
  type SyncJobPayload,
  type WriteBackJobPayload,
} from "@triage-ops/shared-types";

let syncQueue: Queue<SyncJobPayload> | null = null;
let llmAnalysisQueue: Queue<LlmAnalysisJobPayload> | null = null;
let vcsWriteBackQueue: Queue<WriteBackJobPayload> | null = null;

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

export function getLlmAnalysisQueue(): Queue<LlmAnalysisJobPayload> {
  if (!llmAnalysisQueue) {
    llmAnalysisQueue = new Queue<LlmAnalysisJobPayload>(
      QUEUE_NAMES.LLM_ANALYSIS,
      {
        connection: getQueueConnection(),
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: "exponential", delay: 10000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
    );
  }

  return llmAnalysisQueue;
}

export async function enqueueLlmAnalysisJob(
  payload: LlmAnalysisJobPayload,
): Promise<void> {
  const queue = getLlmAnalysisQueue();
  await queue.add("llm-analysis", payload);
}

export function getVcsWriteBackQueue(): Queue<WriteBackJobPayload> {
  if (!vcsWriteBackQueue) {
    vcsWriteBackQueue = new Queue<WriteBackJobPayload>(
      QUEUE_NAMES.VCS_WRITEBACK,
      {
        connection: getQueueConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
    );
  }

  return vcsWriteBackQueue;
}

export async function enqueueWriteBackJob(
  payload: WriteBackJobPayload,
): Promise<void> {
  const queue = getVcsWriteBackQueue();
  await queue.add("vcs-writeback", payload);
}
