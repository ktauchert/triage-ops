import type { AutoSyncJobPayload } from "@gridnull/shared-types";
import type { Job } from "bullmq";
import { runAutoSyncTick } from "../lib/enqueue-project-sync.js";

export async function processAutoSyncJob(
  _job: Job<AutoSyncJobPayload>,
): Promise<void> {
  const enqueued = await runAutoSyncTick();
  if (enqueued > 0) {
    console.log(`[auto-sync] Enqueued ${enqueued} project sync job(s)`);
  }
}
