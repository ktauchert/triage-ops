import { GitHubApiError, GitHubValidationError } from "./client.js";
import { DEFAULT_GITHUB_API_URL } from "@gridnull/shared-types";
import { fetchWithResilience } from "../http.js";

export type FetchFn = typeof fetch;

export type GitHubWriteParams = {
  accessToken: string;
  owner: string;
  repo: string;
  issueNumber: number;
  baseUrl?: string;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function validateWriteParams(params: GitHubWriteParams): void {
  if (!params.accessToken?.trim()) {
    throw new GitHubValidationError("accessToken is required");
  }
  if (!params.owner?.trim()) {
    throw new GitHubValidationError("owner is required");
  }
  if (!params.repo?.trim()) {
    throw new GitHubValidationError("repo is required");
  }
  if (!Number.isInteger(params.issueNumber) || params.issueNumber <= 0) {
    throw new GitHubValidationError("issueNumber must be a positive integer");
  }
}

function issueUrl(params: GitHubWriteParams): string {
  const baseUrl = normalizeBaseUrl(params.baseUrl ?? DEFAULT_GITHUB_API_URL);
  return new URL(
    `/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}`,
    `${baseUrl}/`,
  ).toString();
}

function commentsUrl(params: GitHubWriteParams): string {
  return `${issueUrl(params)}/comments`;
}

async function gitHubRequest(
  method: string,
  url: string,
  accessToken: string,
  body?: Record<string, unknown>,
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  const response = await fetchWithResilience(
    url,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    { fetchImpl },
  );

  if (!response.ok) {
    const responseBody = await response.text().catch(() => undefined);
    throw new GitHubApiError(
      `GitHub API request failed with status ${response.status}`,
      response.status,
      responseBody,
    );
  }
}

async function gitHubGet<T>(
  url: string,
  accessToken: string,
  fetchImpl: FetchFn = fetch,
): Promise<T> {
  const response = await fetchWithResilience(
    url,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    { fetchImpl },
  );

  if (!response.ok) {
    const responseBody = await response.text().catch(() => undefined);
    throw new GitHubApiError(
      `GitHub API request failed with status ${response.status}`,
      response.status,
      responseBody,
    );
  }

  return (await response.json()) as T;
}

export async function getGitHubIssueState(
  params: GitHubWriteParams,
  fetchImpl?: FetchFn,
): Promise<string> {
  validateWriteParams(params);
  const data = await gitHubGet<{ state: string }>(
    issueUrl(params),
    params.accessToken,
    fetchImpl,
  );
  return data.state;
}

export async function listGitHubIssueCommentBodies(
  params: GitHubWriteParams,
  fetchImpl?: FetchFn,
): Promise<string[]> {
  validateWriteParams(params);
  const data = await gitHubGet<Array<{ body?: string }>>(
    commentsUrl(params),
    params.accessToken,
    fetchImpl,
  );
  return data.map((comment) => comment.body ?? "");
}

export async function updateGitHubIssueBody(
  params: GitHubWriteParams & { body: string },
  fetchImpl?: FetchFn,
): Promise<void> {
  validateWriteParams(params);
  await gitHubRequest(
    "PATCH",
    issueUrl(params),
    params.accessToken,
    { body: params.body },
    fetchImpl,
  );
}

export async function addGitHubIssueComment(
  params: GitHubWriteParams & { body: string },
  fetchImpl?: FetchFn,
): Promise<void> {
  validateWriteParams(params);
  await gitHubRequest(
    "POST",
    commentsUrl(params),
    params.accessToken,
    { body: params.body },
    fetchImpl,
  );
}

export async function closeGitHubIssueAsDuplicate(
  params: GitHubWriteParams,
  fetchImpl?: FetchFn,
): Promise<void> {
  validateWriteParams(params);
  await gitHubRequest(
    "PATCH",
    issueUrl(params),
    params.accessToken,
    { state: "closed", state_reason: "duplicate" },
    fetchImpl,
  );
}
