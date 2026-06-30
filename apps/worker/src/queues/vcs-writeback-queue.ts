import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { QUEUE_NAMES, type WriteBackJobPayload } from "@gridnull/shared-types";
import { getQueueConnection } from "./sync-queue.js";

export { getQueueConnection, Worker };

export function createVcsWriteBackQueue(): Queue<WriteBackJobPayload> {
  return new Queue<WriteBackJobPayload>(QUEUE_NAMES.VCS_WRITEBACK, {
    connection: getQueueConnection() as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}
