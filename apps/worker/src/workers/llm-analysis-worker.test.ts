import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const prismaMock = vi.hoisted(() => ({
  llmAnalysisRun: {
    update: vi.fn(),
  },
  issue: {
    findMany: vi.fn(),
  },
  issueSuggestion: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

const lockMock = vi.hoisted(() => ({
  acquireLock: vi.fn(),
}));

const ollamaMock = vi.hoisted(() => ({
  getOllamaConfig: vi.fn(),
  chat: vi.fn(),
  embed: vi.fn(),
}));

vi.mock("@triage-ops/db", () => ({
  IssueState: { OPEN: "OPEN", CLOSED: "CLOSED" },
  IssueSuggestionStatus: {
    PENDING: "PENDING",
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

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({})),
}));

vi.mock("../lib/lock.js", () => lockMock);

vi.mock("../lib/ollama/client.js", () => ollamaMock);

import { processLlmAnalysisJob } from "./llm-analysis-worker.js";

function createJob(data: { projectId: string; analysisRunId: string }): Job {
  return { data } as Job;
}

describe("processLlmAnalysisJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockMock.acquireLock.mockResolvedValue({
      release: vi.fn().mockResolvedValue(true),
    });
    ollamaMock.getOllamaConfig.mockReturnValue({
      host: "http://localhost:11434",
      chatModel: "llama3.2:3b",
      embedModel: "nomic-embed-text",
    });
    prismaMock.issueSuggestion.findMany.mockResolvedValue([]);
    prismaMock.issueSuggestion.create.mockResolvedValue({});
    prismaMock.llmAnalysisRun.update.mockResolvedValue({});
  });

  it("creates duplicate and description suggestions", async () => {
    prismaMock.issue.findMany.mockResolvedValue([
      {
        id: "issue-a",
        gitlabIssueIid: 1,
        title: "Login fails with SSO",
        description: "SSO callback 500",
        labels: [{ label: { name: "bug" } }],
      },
      {
        id: "issue-b",
        gitlabIssueIid: 2,
        title: "SSO login error",
        description: "IdP redirect fails",
        labels: [{ label: { name: "bug" } }],
      },
      {
        id: "issue-c",
        gitlabIssueIid: 3,
        title: "Add pagination",
        description: null,
        labels: [{ label: { name: "enhancement" } }],
      },
    ]);

    ollamaMock.embed.mockResolvedValue([
      [1, 0],
      [0.99, 0.01],
      [0, 1],
    ]);
    ollamaMock.chat.mockResolvedValue("Draft description for pagination.");

    await processLlmAnalysisJob(
      createJob({ projectId: "project-1", analysisRunId: "run-1" }),
    );

    expect(prismaMock.llmAnalysisRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );

    expect(prismaMock.issueSuggestion.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.llmAnalysisRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          suggestionsCreated: 2,
        }),
      }),
    );
  });

  it("marks run failed when Ollama errors", async () => {
    prismaMock.issue.findMany.mockResolvedValue([
      {
        id: "issue-a",
        gitlabIssueIid: 1,
        title: "Login fails",
        description: null,
        labels: [],
      },
    ]);
    ollamaMock.embed.mockRejectedValue(new Error("Ollama unavailable"));

    await expect(
      processLlmAnalysisJob(
        createJob({ projectId: "project-1", analysisRunId: "run-1" }),
      ),
    ).rejects.toThrow("Ollama unavailable");

    expect(prismaMock.llmAnalysisRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "Ollama unavailable",
        }),
      }),
    );
  });
});
