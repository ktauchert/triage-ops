import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

const prismaMock = vi.hoisted(() => ({
  syncRun: {
    update: vi.fn(),
  },
}));

const lockMock = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  startLockHeartbeat: vi.fn(() => () => {}),
}));

vi.mock("@gridnull/db", () => ({
  IssueState: { OPEN: "OPEN", CLOSED: "CLOSED" },
  SyncStatus: {
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
  },
  prisma: prismaMock,
  openAccessToken: (value: string) => value,
}));

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({})),
}));

vi.mock("../lib/lock.js", () => lockMock);

vi.mock("../lib/vcs/fetch-project-issues.js", () => ({
  fetchProjectIssues: vi.fn(),
}));

import { processSyncJob } from "./sync-worker.js";

function createJob(data: { projectId: string; syncRunId: string }): Job {
  return { data } as Job;
}

describe("processSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the sync run FAILED when the lock cannot be acquired", async () => {
    lockMock.acquireLock.mockResolvedValue(null);

    await expect(
      processSyncJob(createJob({ projectId: "p1", syncRunId: "run-1" })),
    ).rejects.toThrow(/in progress/);

    expect(prismaMock.syncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    expect(lockMock.startLockHeartbeat).not.toHaveBeenCalled();
  });
});
