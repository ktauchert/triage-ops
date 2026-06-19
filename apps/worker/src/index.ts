import { QUEUE_NAMES } from "@triage-ops/shared-types";
import { Worker } from "bullmq";
import { getOptionalEnv } from "./config/env.js";
import { closeRedis, getRedis } from "./lib/redis.js";
import { getQueueConnection } from "./queues/sync-queue.js";
import { processSyncJob } from "./workers/sync-worker.js";
import { processLlmAnalysisJob } from "./workers/llm-analysis-worker.js";

const syncConcurrency = parseInt(
  getOptionalEnv("WORKER_CONCURRENCY", "2"),
  10,
);
const llmConcurrency = parseInt(
  getOptionalEnv("LLM_WORKER_CONCURRENCY", "1"),
  10,
);

const syncWorker = new Worker(QUEUE_NAMES.GITLAB_SYNC, processSyncJob, {
  connection: getQueueConnection(),
  concurrency: syncConcurrency,
});

const llmWorker = new Worker(QUEUE_NAMES.LLM_ANALYSIS, processLlmAnalysisJob, {
  connection: getQueueConnection(),
  concurrency: llmConcurrency,
});

syncWorker.on("completed", (job) => {
  console.log(`[sync] Job ${job.id} completed for project ${job.data.projectId}`);
});

syncWorker.on("failed", (job, error) => {
  console.error(
    `[sync] Job ${job?.id ?? "unknown"} failed:`,
    error.message,
  );
});

llmWorker.on("completed", (job) => {
  console.log(
    `[llm] Job ${job.id} completed for project ${job.data.projectId}`,
  );
});

llmWorker.on("failed", (job, error) => {
  console.error(
    `[llm] Job ${job?.id ?? "unknown"} failed:`,
    error.message,
  );
});

async function shutdown(): Promise<void> {
  console.log("[worker] Shutting down...");
  await Promise.all([syncWorker.close(), llmWorker.close()]);
  await closeRedis();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `[worker] Sync worker listening on "${QUEUE_NAMES.GITLAB_SYNC}" (concurrency=${syncConcurrency})`,
);
console.log(
  `[worker] LLM worker listening on "${QUEUE_NAMES.LLM_ANALYSIS}" (concurrency=${llmConcurrency})`,
);
console.log(`[worker] Redis connected: ${getRedis().status}`);
