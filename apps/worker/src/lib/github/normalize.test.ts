import { describe, expect, it } from "vitest";
import { VcsProvider } from "@gridnull/db";
import {
  isGitHubPullRequest,
  normalizeGitHubIssue,
  parseGitHubRepo,
} from "./normalize.js";

describe("parseGitHubRepo", () => {
  it("parses owner/repo", () => {
    expect(parseGitHubRepo("acme/widgets")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
  });

  it("supports nested repo names", () => {
    expect(parseGitHubRepo("org/team/repo")).toEqual({
      owner: "org",
      repo: "team/repo",
    });
  });

  it("rejects invalid paths", () => {
    expect(() => parseGitHubRepo("invalid")).toThrow(
      "pathWithNamespace must be in owner/repo format",
    );
  });
});

describe("normalizeGitHubIssue", () => {
  it("maps GitHub fields to normalized issue", () => {
    const normalized = normalizeGitHubIssue({
      id: 1001,
      number: 7,
      title: "Bug",
      body: "Details",
      state: "open",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      closed_at: null,
      user: { login: "alice" },
      assignee: { login: "bob" },
      labels: [],
      milestone: null,
    });

    expect(normalized).toEqual({
      externalIssueId: 1001,
      issueNumber: 7,
      title: "Bug",
      description: "Details",
      state: "open",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-06-01T00:00:00Z",
      closedAt: null,
      authorUsername: "alice",
      assigneeUsername: "bob",
      weight: null,
      labels: [],
      milestone: null,
    });
  });

  it("maps GitHub label names", () => {
    const normalized = normalizeGitHubIssue({
      id: 1001,
      number: 7,
      title: "Bug",
      body: "Details",
      state: "open",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      closed_at: null,
      user: { login: "alice" },
      assignee: null,
      labels: [{ name: "bug" }, { name: "priority::high" }],
      milestone: null,
    });

    expect(normalized.labels).toEqual(["bug", "priority::high"]);
  });

  it("maps GitHub milestone due date and state", () => {
    const normalized = normalizeGitHubIssue({
      id: 1001,
      number: 7,
      title: "Bug",
      body: "Details",
      state: "open",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      closed_at: null,
      user: { login: "alice" },
      assignee: null,
      labels: [],
      milestone: {
        id: 55,
        title: "Sprint 1",
        due_on: "2026-06-01",
        state: "open",
      },
    });

    expect(normalized.milestone).toEqual({
      externalId: 55,
      title: "Sprint 1",
      dueDate: "2026-06-01",
      state: "open",
    });
  });
});

describe("isGitHubPullRequest", () => {
  it("detects pull requests", () => {
    expect(
      isGitHubPullRequest({
        id: 1,
        number: 1,
        title: "PR",
        body: null,
        state: "open",
        created_at: "",
        updated_at: "",
        closed_at: null,
        user: { login: "alice" },
        assignee: null,
        labels: [],
        milestone: null,
        pull_request: { url: "https://example.com" },
      }),
    ).toBe(true);
  });
});

describe("fetchProjectIssues routing", () => {
  it("documents provider enum values", () => {
    expect(VcsProvider.GITHUB).toBe("GITHUB");
    expect(VcsProvider.GITLAB).toBe("GITLAB");
  });
});
