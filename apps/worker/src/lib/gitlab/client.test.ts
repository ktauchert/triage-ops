import { describe, expect, it } from "vitest";
import {
  fetchGitLabIssues,
  GitLabApiError,
  GitLabValidationError,
} from "./client.js";
import {
  gitlabErrorHandler,
  gitlabIssuesHandler,
  server,
} from "../../test/msw-server.js";

const baseParams = {
  baseUrl: "https://gitlab.example.com",
  accessToken: "glpat-test-token",
  gitlabProjectId: 42,
};

const sampleIssue = {
  id: 1001,
  iid: 7,
  title: "Fix login bug",
  description: "Users cannot log in",
  state: "opened" as const,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-06-01T00:00:00Z",
  closed_at: null,
  author: { username: "alice" },
  assignee: { username: "bob" },
  labels: ["bug"],
  weight: 3,
  milestone: { id: 99, title: "Sprint 1" },
};

describe("validateFetchParams", () => {
  it("rejects empty baseUrl", async () => {
    await expect(
      fetchGitLabIssues({ ...baseParams, baseUrl: "" }),
    ).rejects.toThrow(GitLabValidationError);
  });

  it("rejects empty accessToken", async () => {
    await expect(
      fetchGitLabIssues({ ...baseParams, accessToken: "" }),
    ).rejects.toThrow(GitLabValidationError);
  });

  it("rejects invalid gitlabProjectId", async () => {
    await expect(
      fetchGitLabIssues({ ...baseParams, gitlabProjectId: 0 }),
    ).rejects.toThrow(GitLabValidationError);
  });

  it("rejects page below 1", async () => {
    await expect(
      fetchGitLabIssues({ ...baseParams, page: 0 }),
    ).rejects.toThrow(GitLabValidationError);
  });

  it("rejects perPage above 100", async () => {
    await expect(
      fetchGitLabIssues({ ...baseParams, perPage: 101 }),
    ).rejects.toThrow(GitLabValidationError);
  });
});

describe("fetchGitLabIssues", () => {
  it("returns issues on success with correct shape", async () => {
    server.use(gitlabIssuesHandler(42, [sampleIssue]));

    const result = await fetchGitLabIssues(baseParams);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      id: 1001,
      iid: 7,
      title: "Fix login bug",
      state: "opened",
    });
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
  });

  it("handles pagination headers", async () => {
    server.use(gitlabIssuesHandler(42, [sampleIssue], 3, 2));

    const result = await fetchGitLabIssues({ ...baseParams, page: 2 });

    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(2);
  });

  it("returns empty issues array when no matches found", async () => {
    server.use(gitlabIssuesHandler(42, []));

    const result = await fetchGitLabIssues(baseParams);

    expect(result.issues).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("throws GitLabApiError on 401 unauthorized", async () => {
    server.use(gitlabErrorHandler(42, 401, '{"message":"401 Unauthorized"}'));

    await expect(fetchGitLabIssues(baseParams)).rejects.toMatchObject({
      name: "GitLabApiError",
      status: 401,
    } satisfies Partial<GitLabApiError>);
  });

  it("throws GitLabApiError on 500 server crash", async () => {
    server.use(gitlabErrorHandler(42, 500, "Internal Server Error"));

    await expect(fetchGitLabIssues(baseParams)).rejects.toMatchObject({
      name: "GitLabApiError",
      status: 500,
    } satisfies Partial<GitLabApiError>);
  });

  it("strips trailing slashes from baseUrl", async () => {
    server.use(gitlabIssuesHandler(42, [sampleIssue]));

    const result = await fetchGitLabIssues({
      ...baseParams,
      baseUrl: "https://gitlab.example.com///",
    });

    expect(result.issues).toHaveLength(1);
  });
});
