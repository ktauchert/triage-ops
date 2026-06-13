import { QUEUE_NAMES } from "@triage-ops/shared-types";
import { Worker } from "bullmq";
import { getOptionalEnv } from "./config/env.js";
import { closeRedis, getRedis } from "./lib/redis.js";
import { getQueueConnection } from "./queues/sync-queue.js";
import { processSyncJob } from "./workers/sync-worker.js";

const concurrency = parseInt(getOptionalEnv("WORKER_CONCURRENCY", "2"), 10);

const worker = new Worker(QUEUE_NAMES.GITLAB_SYNC, processSyncJob, {
  connection: getQueueConnection(),
  concurrency,
});

worker.on("completed", (job) => {
  console.log(`[sync] Job ${job.id} completed for project ${job.data.projectId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `[sync] Job ${job?.id ?? "unknown"} failed:`,
    error.message,
  );
});

async function shutdown(): Promise<void> {
  console.log("[worker] Shutting down...");
  await worker.close();
  await closeRedis();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `[worker] TriageOps worker listening on queue "${QUEUE_NAMES.GITLAB_SYNC}" (concurrency=${concurrency})`,
);
console.log(`[worker] Redis connected: ${getRedis().status}`);
