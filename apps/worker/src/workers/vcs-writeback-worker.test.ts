import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const prismaMock = vi.hoisted(() => ({
  issueSuggestion: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  issue: {
    update: vi.fn(),
  },
}));

const lockMock = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  startLockHeartbeat: vi.fn(() => () => {}),
}));

const applyMock = vi.hoisted(() => ({
  applySuggestionToVcs: vi.fn(),
}));

vi.mock("@gridnull/db", () => ({
  IssueState: { OPEN: "OPEN", CLOSED: "CLOSED" },
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
  VcsProvider: {
    GITLAB: "GITLAB",
    GITHUB: "GITHUB",
  },
  prisma: prismaMock,
  openAccessToken: (value: string) => value,
}));

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({})),
}));

vi.mock("../lib/lock.js", () => lockMock);

vi.mock("../lib/vcs/apply-suggestion.js", () => applyMock);

import { processVcsWriteBackJob } from "./vcs-writeback-worker.js";

function createJob(data: { projectId: string; suggestionId: string }): Job {
  return { data } as Job;
}

function applyingSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "suggestion-1",
    status: "APPLYING",
    type: "DESCRIPTION",
    suggestedText: "Draft body",
    issue: { id: "issue-1", gitlabIssueIid: 15 },
    relatedIssue: null,
    project: {
      externalProjectId: 42,
      pathWithNamespace: "acme/widgets",
      connection: {
        provider: "GITLAB",
        baseUrl: "https://gitlab.example.com",
        accessToken: "token",
      },
    },
    ...overrides,
  };
}

describe("processVcsWriteBackJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockMock.acquireLock.mockResolvedValue({
      release: vi.fn().mockResolvedValue(true),
    });
    prismaMock.issue.update.mockResolvedValue({});
    prismaMock.issueSuggestion.update.mockResolvedValue({});
  });

  it("marks suggestion applied after successful VCS write", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(applyingSuggestion());
    applyMock.applySuggestionToVcs.mockResolvedValue({
      updatedIssueIds: ["issue-1"],
      localUpdates: [{ issueId: "issue-1", description: "Draft body" }],
    });

    await processVcsWriteBackJob(
      createJob({ projectId: "project-1", suggestionId: "suggestion-1" }),
    );

    expect(prismaMock.issueSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "suggestion-1" },
        data: expect.objectContaining({ status: "APPLIED" }),
      }),
    );
  });

  it("marks suggestion failed when VCS apply throws", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(applyingSuggestion());
    applyMock.applySuggestionToVcs.mockRejectedValue(
      new Error("GitLab API 403"),
    );

    await expect(
      processVcsWriteBackJob(
        createJob({ projectId: "project-1", suggestionId: "suggestion-1" }),
      ),
    ).rejects.toThrow("GitLab API 403");

    expect(prismaMock.issueSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "suggestion-1" },
        data: expect.objectContaining({
          status: "APPLY_FAILED",
          writeBackError: "GitLab API 403",
        }),
      }),
    );
  });

  it("keeps suggestion APPLYING for retry on a non-final attempt", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(applyingSuggestion());
    applyMock.applySuggestionToVcs.mockRejectedValue(new Error("503 transient"));

    const job = {
      data: { projectId: "project-1", suggestionId: "suggestion-1" },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as Job;

    await expect(processVcsWriteBackJob(job)).rejects.toThrow("503 transient");

    expect(prismaMock.issueSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "suggestion-1" },
        data: expect.objectContaining({
          status: "APPLYING",
          writeBackError: "503 transient",
        }),
      }),
    );
  });

  it("re-runs a previously APPLY_FAILED suggestion", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(
      applyingSuggestion({ status: "APPLY_FAILED" }),
    );
    applyMock.applySuggestionToVcs.mockResolvedValue({
      updatedIssueIds: ["issue-1"],
      localUpdates: [{ issueId: "issue-1", description: "Draft body" }],
    });

    await processVcsWriteBackJob(
      createJob({ projectId: "project-1", suggestionId: "suggestion-1" }),
    );

    expect(applyMock.applySuggestionToVcs).toHaveBeenCalled();
    expect(prismaMock.issueSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPLIED" }),
      }),
    );
  });

  it("throws when suggestion is not found", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(null);

    await expect(
      processVcsWriteBackJob(
        createJob({ projectId: "project-1", suggestionId: "suggestion-1" }),
      ),
    ).rejects.toThrow("Suggestion suggestion-1 not found");

    expect(applyMock.applySuggestionToVcs).not.toHaveBeenCalled();
  });

  it("skips VCS write when suggestion is not APPLYING", async () => {
    prismaMock.issueSuggestion.findFirst.mockResolvedValue(
      applyingSuggestion({ status: "PENDING" }),
    );

    await processVcsWriteBackJob(
      createJob({ projectId: "project-1", suggestionId: "suggestion-1" }),
    );

    expect(applyMock.applySuggestionToVcs).not.toHaveBeenCalled();
    expect(prismaMock.issueSuggestion.update).not.toHaveBeenCalled();
  });

  it("marks suggestion failed when lock is unavailable", async () => {
    lockMock.acquireLock.mockResolvedValue(null);

    await processVcsWriteBackJob(
      createJob({ projectId: "project-1", suggestionId: "suggestion-1" }),
    );

    expect(prismaMock.issueSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "suggestion-1" },
        data: expect.objectContaining({ status: "APPLY_FAILED" }),
      }),
    );
  });
});
