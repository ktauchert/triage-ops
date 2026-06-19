import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, type LlmAnalysisJobPayload } from "@triage-ops/shared-types";
import { getQueueConnection } from "./sync-queue.js";

export { getQueueConnection, Worker };

export function createLlmAnalysisQueue(): Queue<LlmAnalysisJobPayload> {
  return new Queue<LlmAnalysisJobPayload>(QUEUE_NAMES.LLM_ANALYSIS, {
    connection: getQueueConnection() as ConnectionOptions,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 10000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}
