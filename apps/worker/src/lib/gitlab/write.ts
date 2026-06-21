import { GitLabApiError, GitLabValidationError } from "./client.js";

export type FetchFn = typeof fetch;

export type GitLabWriteParams = {
  baseUrl: string;
  accessToken: string;
  gitlabProjectId: number;
  issueIid: number;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function validateWriteParams(params: GitLabWriteParams): void {
  if (!params.baseUrl?.trim()) {
    throw new GitLabValidationError("baseUrl is required");
  }
  if (!params.accessToken?.trim()) {
    throw new GitLabValidationError("accessToken is required");
  }
  if (!Number.isInteger(params.gitlabProjectId) || params.gitlabProjectId <= 0) {
    throw new GitLabValidationError("gitlabProjectId must be a positive integer");
  }
  if (!Number.isInteger(params.issueIid) || params.issueIid <= 0) {
    throw new GitLabValidationError("issueIid must be a positive integer");
  }
}

function issueUrl(params: GitLabWriteParams): string {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  return new URL(
    `/api/v4/projects/${params.gitlabProjectId}/issues/${params.issueIid}`,
    `${baseUrl}/`,
  ).toString();
}

async function gitLabRequest(
  method: string,
  url: string,
  accessToken: string,
  body?: Record<string, unknown>,
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  const response = await fetchImpl(url, {
    method,
    headers: {
      "PRIVATE-TOKEN": accessToken,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => undefined);
    throw new GitLabApiError(
      `GitLab API request failed with status ${response.status}`,
      response.status,
      responseBody,
    );
  }
}

export async function updateGitLabIssueDescription(
  params: GitLabWriteParams & { description: string },
  fetchImpl?: FetchFn,
): Promise<void> {
  validateWriteParams(params);
  await gitLabRequest(
    "PUT",
    issueUrl(params),
    params.accessToken,
    { description: params.description },
    fetchImpl,
  );
}

export async function addGitLabIssueNote(
  params: GitLabWriteParams & { body: string },
  fetchImpl?: FetchFn,
): Promise<void> {
  validateWriteParams(params);
  const notesUrl = `${issueUrl(params)}/notes`;
  await gitLabRequest(
    "POST",
    notesUrl,
    params.accessToken,
    { body: params.body },
    fetchImpl,
  );
}

export async function closeGitLabIssue(
  params: GitLabWriteParams,
  fetchImpl?: FetchFn,
): Promise<void> {
  validateWriteParams(params);
  await gitLabRequest(
    "PUT",
    issueUrl(params),
    params.accessToken,
    { state_event: "close" },
    fetchImpl,
  );
}
