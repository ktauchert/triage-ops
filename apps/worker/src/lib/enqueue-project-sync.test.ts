import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  syncRun: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
  },
}));

const queueAddMock = vi.hoisted(() => vi.fn());

vi.mock("@gridnull/db", () => ({
  SyncStatus: {
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
  },
  prisma: prismaMock,
}));

vi.mock("../queues/sync-queue.js", () => ({
  createSyncQueue: () => ({
    add: queueAddMock,
  }),
}));

import {
  enqueueProjectSyncIfIdle,
  runAutoSyncTick,
} from "./enqueue-project-sync.js";

describe("enqueueProjectSyncIfIdle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when a sync is already active", async () => {
    prismaMock.syncRun.findFirst.mockResolvedValue({ id: "run-1" });

    const queued = await enqueueProjectSyncIfIdle("project-1");

    expect(queued).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("creates a sync run and enqueues a job", async () => {
    prismaMock.syncRun.findFirst.mockResolvedValue(null);
    prismaMock.syncRun.create.mockResolvedValue({ id: "run-2" });

    const queued = await enqueueProjectSyncIfIdle("project-1");

    expect(queued).toBe(true);
    expect(queueAddMock).toHaveBeenCalledWith("sync", {
      projectId: "project-1",
      syncRunId: "run-2",
    });
  });
});

describe("runAutoSyncTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.syncRun.findFirst.mockResolvedValue(null);
    prismaMock.syncRun.create.mockResolvedValue({ id: "run-3" });
  });

  it("enqueues sync for due projects only", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    prismaMock.project.findMany.mockResolvedValue([
      {
        id: "due",
        autoSyncIntervalMinutes: 60,
        lastSyncedAt: twoHoursAgo,
      },
      {
        id: "fresh",
        autoSyncIntervalMinutes: 60,
        lastSyncedAt: new Date(),
      },
    ]);

    const enqueued = await runAutoSyncTick();

    expect(enqueued).toBe(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});
