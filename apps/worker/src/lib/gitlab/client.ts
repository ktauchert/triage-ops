import type {
  FetchGitLabIssuesParams,
  GitLabIssueRaw,
  GitLabIssuesPage,
} from "@triage-ops/shared-types";
import { fetchWithResilience } from "../http.js";

export class GitLabApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "GitLabApiError";
  }
}

export class GitLabValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitLabValidationError";
  }
}

export type FetchFn = typeof fetch;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function validateFetchParams(params: FetchGitLabIssuesParams): void {
  if (!params.baseUrl?.trim()) {
    throw new GitLabValidationError("baseUrl is required");
  }
  if (!params.accessToken?.trim()) {
    throw new GitLabValidationError("accessToken is required");
  }
  if (!Number.isInteger(params.gitlabProjectId) || params.gitlabProjectId <= 0) {
    throw new GitLabValidationError("gitlabProjectId must be a positive integer");
  }
  if (params.page !== undefined && params.page < 1) {
    throw new GitLabValidationError("page must be >= 1");
  }
  if (params.perPage !== undefined && (params.perPage < 1 || params.perPage > 100)) {
    throw new GitLabValidationError("perPage must be between 1 and 100");
  }
}

export async function fetchGitLabIssues(
  params: FetchGitLabIssuesParams,
  fetchImpl: FetchFn = fetch,
): Promise<GitLabIssuesPage> {
  validateFetchParams(params);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 100;
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const url = new URL(
    `/api/v4/projects/${params.gitlabProjectId}/issues`,
    `${baseUrl}/`,
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("state", "all");
  url.searchParams.set("order_by", "updated_at");
  url.searchParams.set("sort", "asc");

  const response = await fetchWithResilience(
    url.toString(),
    {
      headers: {
        "PRIVATE-TOKEN": params.accessToken,
        Accept: "application/json",
      },
    },
    { fetchImpl },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => undefined);
    throw new GitLabApiError(
      `GitLab API request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  const issues = (await response.json()) as GitLabIssueRaw[];
  const totalPages = parseInt(response.headers.get("x-total-pages") ?? "1", 10);

  return {
    issues,
    totalPages: Number.isNaN(totalPages) ? 1 : totalPages,
    currentPage: page,
  };
}
