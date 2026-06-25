import { assertEncryptionConfigured } from "@triage-ops/db";
import { QUEUE_NAMES } from "@triage-ops/shared-types";
import { Worker } from "bullmq";
import { getOptionalEnv } from "./config/env.js";
import { recoverInterruptedLlmRuns } from "./lib/llm/recover.js";
import { recoverInterruptedSyncRuns } from "./lib/recover-sync.js";
import { closeRedis, getRedis } from "./lib/redis.js";
import { getQueueConnection } from "./queues/sync-queue.js";
import { processSyncJob } from "./workers/sync-worker.js";
import { processLlmAnalysisJob } from "./workers/llm-analysis-worker.js";
import { processVcsWriteBackJob } from "./workers/vcs-writeback-worker.js";
import { processAutoSyncJob } from "./workers/auto-sync-worker.js";
import { registerAutoSyncSchedule } from "./queues/auto-sync-queue.js";

assertEncryptionConfigured();

const syncConcurrency = parseInt(
  getOptionalEnv("WORKER_CONCURRENCY", "2"),
  10,
);
const llmConcurrency = parseInt(
  getOptionalEnv("LLM_WORKER_CONCURRENCY", "1"),
  10,
);
const writeBackConcurrency = parseInt(
  getOptionalEnv("WRITEBACK_WORKER_CONCURRENCY", "2"),
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

const writeBackWorker = new Worker(
  QUEUE_NAMES.VCS_WRITEBACK,
  processVcsWriteBackJob,
  {
    connection: getQueueConnection(),
    concurrency: writeBackConcurrency,
  },
);

const autoSyncWorker = new Worker(
  QUEUE_NAMES.AUTO_SYNC,
  processAutoSyncJob,
  {
    connection: getQueueConnection(),
    concurrency: 1,
  },
);

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

writeBackWorker.on("completed", (job) => {
  console.log(
    `[writeback] Job ${job.id} completed for suggestion ${job.data.suggestionId}`,
  );
});

writeBackWorker.on("failed", (job, error) => {
  console.error(
    `[writeback] Job ${job?.id ?? "unknown"} failed:`,
    error.message,
  );
});

autoSyncWorker.on("failed", (job, error) => {
  console.error(
    `[auto-sync] Job ${job?.id ?? "unknown"} failed:`,
    error.message,
  );
});

async function shutdown(): Promise<void> {
  console.log("[worker] Shutting down...");
  await Promise.all([
    syncWorker.close(),
    llmWorker.close(),
    writeBackWorker.close(),
    autoSyncWorker.close(),
  ]);
  await closeRedis();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const recoveredRuns = await recoverInterruptedLlmRuns();
if (recoveredRuns > 0) {
  console.log(`[llm] Recovered ${recoveredRuns} interrupted analysis run(s)`);
}

const recoveredSyncRuns = await recoverInterruptedSyncRuns();
if (recoveredSyncRuns > 0) {
  console.log(
    `[sync] Recovered ${recoveredSyncRuns} interrupted sync/write-back run(s)`,
  );
}

await registerAutoSyncSchedule();

console.log(
  `[worker] Sync worker listening on "${QUEUE_NAMES.GITLAB_SYNC}" (concurrency=${syncConcurrency})`,
);
console.log(
  `[worker] LLM worker listening on "${QUEUE_NAMES.LLM_ANALYSIS}" (concurrency=${llmConcurrency})`,
);
console.log(
  `[worker] Write-back worker listening on "${QUEUE_NAMES.VCS_WRITEBACK}" (concurrency=${writeBackConcurrency})`,
);
console.log(
  `[worker] Auto-sync worker listening on "${QUEUE_NAMES.AUTO_SYNC}"`,
);
console.log(`[worker] Redis connected: ${getRedis().status}`);
