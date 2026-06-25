import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  syncRun: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  issueSuggestion: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const lockMock = vi.hoisted(() => ({
  forceReleaseLock: vi.fn(),
}));

vi.mock("@triage-ops/db", () => ({
  SyncStatus: { PENDING: "PENDING", RUNNING: "RUNNING", FAILED: "FAILED" },
  IssueSuggestionStatus: {
    APPLYING: "APPLYING",
    APPLY_FAILED: "APPLY_FAILED",
  },
  prisma: prismaMock,
}));

vi.mock("./redis.js", () => ({
  getRedis: vi.fn(() => ({})),
}));

vi.mock("./lock.js", () => lockMock);

import { recoverInterruptedSyncRuns } from "./recover-sync.js";

describe("recoverInterruptedSyncRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.syncRun.findMany.mockResolvedValue([]);
    prismaMock.issueSuggestion.findMany.mockResolvedValue([]);
  });

  it("is a no-op when nothing is stale", async () => {
    await expect(recoverInterruptedSyncRuns()).resolves.toBe(0);
    expect(prismaMock.syncRun.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.issueSuggestion.updateMany).not.toHaveBeenCalled();
    expect(lockMock.forceReleaseLock).not.toHaveBeenCalled();
  });

  it("fails stale runs, resets applying suggestions, and releases locks", async () => {
    prismaMock.syncRun.findMany.mockResolvedValue([
      { id: "run-1", projectId: "p1" },
    ]);
    prismaMock.issueSuggestion.findMany.mockResolvedValue([
      { id: "sug-1", projectId: "p1" },
      { id: "sug-2", projectId: "p2" },
    ]);

    const count = await recoverInterruptedSyncRuns();

    expect(count).toBe(3);
    expect(lockMock.forceReleaseLock).toHaveBeenCalledWith({}, "sync:p1");
    expect(lockMock.forceReleaseLock).toHaveBeenCalledWith({}, "sync:p2");
    expect(prismaMock.syncRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["run-1"] } },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    expect(prismaMock.issueSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["sug-1", "sug-2"] } },
        data: expect.objectContaining({ status: "APPLY_FAILED" }),
      }),
    );
  });
});
