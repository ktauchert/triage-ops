import { describe, expect, it } from "vitest";
import {
  fetchGitHubIssues,
  GitHubApiError,
  GitHubValidationError,
} from "./client.js";
import {
  githubErrorHandler,
  githubIssuesHandler,
  server,
} from "../../test/msw-server.js";

const baseParams = {
  accessToken: "ghp-test-token",
  owner: "acme",
  repo: "widgets",
};

const sampleIssue = {
  id: 1001,
  number: 7,
  title: "Fix login bug",
  body: "Users cannot log in",
  state: "open" as const,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-06-01T00:00:00Z",
  closed_at: null,
  user: { login: "alice" },
  assignee: { login: "bob" },
  labels: [{ name: "bug" }],
  milestone: { id: 99, title: "Sprint 1" },
};

const samplePullRequest = {
  ...sampleIssue,
  id: 1002,
  number: 8,
  title: "Add OAuth",
  pull_request: { url: "https://api.github.com/repos/acme/widgets/pulls/8" },
};

describe("validateFetchParams", () => {
  it("rejects empty accessToken", async () => {
    await expect(
      fetchGitHubIssues({ ...baseParams, accessToken: "" }),
    ).rejects.toThrow(GitHubValidationError);
  });

  it("rejects empty owner", async () => {
    await expect(
      fetchGitHubIssues({ ...baseParams, owner: "" }),
    ).rejects.toThrow(GitHubValidationError);
  });

  it("rejects page below 1", async () => {
    await expect(
      fetchGitHubIssues({ ...baseParams, page: 0 }),
    ).rejects.toThrow(GitHubValidationError);
  });
});

describe("fetchGitHubIssues", () => {
  it("returns issues on success", async () => {
    server.use(githubIssuesHandler("acme", "widgets", [sampleIssue]));

    const result = await fetchGitHubIssues(baseParams);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.number).toBe(7);
    expect(result.hasNextPage).toBe(false);
  });

  it("detects next page from Link header", async () => {
    server.use(
      githubIssuesHandler("acme", "widgets", [sampleIssue], {
        hasNextPage: true,
      }),
    );

    const result = await fetchGitHubIssues(baseParams);

    expect(result.hasNextPage).toBe(true);
  });

  it("returns empty array for repos with no issues", async () => {
    server.use(githubIssuesHandler("acme", "widgets", []));

    const result = await fetchGitHubIssues(baseParams);

    expect(result.issues).toEqual([]);
  });

  it("throws GitHubApiError on 401 unauthorized", async () => {
    server.use(
      githubErrorHandler("acme", "widgets", 401, '{"message":"Bad credentials"}'),
    );

    await expect(fetchGitHubIssues(baseParams)).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 401,
    } satisfies Partial<GitHubApiError>);
  });

  it("throws GitHubApiError on 500 server crash", async () => {
    server.use(
      githubErrorHandler("acme", "widgets", 500, "Internal Server Error"),
    );

    await expect(fetchGitHubIssues(baseParams)).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 500,
    } satisfies Partial<GitHubApiError>);
  });
});

describe("pull request filtering", () => {
  it("includes pull requests in raw response (filtered upstream)", async () => {
    server.use(
      githubIssuesHandler("acme", "widgets", [sampleIssue, samplePullRequest]),
    );

    const result = await fetchGitHubIssues(baseParams);

    expect(result.issues).toHaveLength(2);
  });
});
