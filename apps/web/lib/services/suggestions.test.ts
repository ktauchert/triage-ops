import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  issueSuggestion: {
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  llmAnalysisRun: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const getProjectByIdMock = vi.hoisted(() => vi.fn());
const enqueueWriteBackJobMock = vi.hoisted(() => vi.fn());

vi.mock("@triage-ops/db", () => ({
  IssueSuggestionStatus: {
    PENDING: "PENDING",
    APPLYING: "APPLYING",
    APPLY_FAILED: "APPLY_FAILED",
    DISMISSED: "DISMISSED",
    APPLIED: "APPLIED",
  },
  IssueSuggestionType: {
    DUPLICATE: "DUPLICATE",
    DESCRIPTION: "DESCRIPTION",
  },
  SyncStatus: {
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
  },
  prisma: prismaMock,
}));

vi.mock("@/lib/services/projects", () => ({
  getProjectById: getProjectByIdMock,
}));

vi.mock("@/lib/queue", () => ({
  enqueueWriteBackJob: enqueueWriteBackJobMock,
}));

vi.mock("@/lib/lock", () => ({
  isLockHeld: vi.fn().mockResolvedValue(false),
  forceReleaseLock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => ({})),
}));

import { clearProjectAnalysis, updateSuggestionStatus } from "./suggestions";

const ctx = { userId: "user-1", dataScope: "shared" as const };

describe("updateSuggestionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectByIdMock.mockResolvedValue({ id: "project-1" });
    enqueueWriteBackJobMock.mockResolvedValue(undefined);
  });

  it("dismisses a pending suggestion without enqueueing write-back", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      status: "PENDING",
      type: "DESCRIPTION",
      suggestedText: "Draft",
      relatedIssueId: null,
    });
    prismaMock.issueSuggestion.update.mockResolvedValue({
      id: "suggestion-1",
      status: "DISMISSED",
    });

    const result = await updateSuggestionStatus(
      ctx,
      "project-1",
      "suggestion-1",
      { status: "DISMISSED" },
    );

    expect(result).toEqual({
      suggestion: { id: "suggestion-1", status: "DISMISSED" },
      queued: false,
    });
    expect(enqueueWriteBackJobMock).not.toHaveBeenCalled();
  });

  it("queues write-back when applying a pending description suggestion", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      status: "PENDING",
      type: "DESCRIPTION",
      suggestedText: "Draft body",
      relatedIssueId: null,
    });
    prismaMock.issueSuggestion.update.mockResolvedValue({
      id: "suggestion-1",
      status: "APPLYING",
    });

    const result = await updateSuggestionStatus(
      ctx,
      "project-1",
      "suggestion-1",
      { status: "APPLIED" },
    );

    expect(result).toEqual({
      suggestion: { id: "suggestion-1", status: "APPLYING" },
      queued: true,
    });
    expect(enqueueWriteBackJobMock).toHaveBeenCalledWith({
      projectId: "project-1",
      suggestionId: "suggestion-1",
    });
  });

  it("allows retry from APPLY_FAILED", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      status: "APPLY_FAILED",
      type: "DUPLICATE",
      suggestedText: null,
      relatedIssueId: "issue-2",
    });
    prismaMock.issueSuggestion.update.mockResolvedValue({
      id: "suggestion-1",
      status: "APPLYING",
    });

    const result = await updateSuggestionStatus(
      ctx,
      "project-1",
      "suggestion-1",
      { status: "APPLIED" },
    );

    expect(result?.queued).toBe(true);
    expect(enqueueWriteBackJobMock).toHaveBeenCalled();
  });
});

describe("clearProjectAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectByIdMock.mockResolvedValue({ id: "project-1" });
    prismaMock.llmAnalysisRun.findFirst.mockResolvedValue(null);
  });

  it("rejects clear while a suggestion is being applied", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      status: "APPLYING",
    });

    const result = await clearProjectAnalysis(ctx, "project-1");

    expect(result).toEqual({
      cleared: false,
      reason: "A suggestion is being applied to VCS",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("clears analysis when no apply is in progress", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue([
      { count: 3 },
      { count: 1 },
    ]);

    const result = await clearProjectAnalysis(ctx, "project-1");

    expect(result).toEqual({
      cleared: true,
      suggestionsDeleted: 3,
      runsDeleted: 1,
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
