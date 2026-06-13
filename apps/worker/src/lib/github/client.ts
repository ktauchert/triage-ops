import type {
  FetchGitHubIssuesParams,
  GitHubIssueRaw,
  GitHubIssuesPage,
} from "@triage-ops/shared-types";
import { DEFAULT_GITHUB_API_URL } from "@triage-ops/shared-types";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubValidationError";
  }
}

export type FetchFn = typeof fetch;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function parseHasNextPage(linkHeader: string | null): boolean {
  if (!linkHeader) {
    return false;
  }

  return linkHeader.split(",").some((part) => part.includes('rel="next"'));
}

export function validateFetchParams(params: FetchGitHubIssuesParams): void {
  if (!params.accessToken?.trim()) {
    throw new GitHubValidationError("accessToken is required");
  }
  if (!params.owner?.trim()) {
    throw new GitHubValidationError("owner is required");
  }
  if (!params.repo?.trim()) {
    throw new GitHubValidationError("repo is required");
  }
  if (params.page !== undefined && params.page < 1) {
    throw new GitHubValidationError("page must be >= 1");
  }
  if (params.perPage !== undefined && (params.perPage < 1 || params.perPage > 100)) {
    throw new GitHubValidationError("perPage must be between 1 and 100");
  }
}

export async function fetchGitHubIssues(
  params: FetchGitHubIssuesParams,
  fetchImpl: FetchFn = fetch,
): Promise<GitHubIssuesPage> {
  validateFetchParams(params);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 100;
  const baseUrl = normalizeBaseUrl(params.baseUrl ?? DEFAULT_GITHUB_API_URL);
  const url = new URL(
    `/repos/${params.owner}/${params.repo}/issues`,
    `${baseUrl}/`,
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("state", "all");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "asc");

  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => undefined);
    throw new GitHubApiError(
      `GitHub API request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  const issues = (await response.json()) as GitHubIssueRaw[];

  return {
    issues,
    hasNextPage: parseHasNextPage(response.headers.get("link")),
    currentPage: page,
  };
}
