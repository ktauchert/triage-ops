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
}));

const applyMock = vi.hoisted(() => ({
  applySuggestionToVcs: vi.fn(),
}));

vi.mock("@triage-ops/db", () => ({
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
    prismaMock.issueSuggestion.findFirst.mockResolvedValue({
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
    });
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
