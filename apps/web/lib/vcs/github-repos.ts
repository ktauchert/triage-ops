import type {
  FetchGitHubReposParams,
  GitHubRepoRaw,
  GitHubReposPage,
} from "@gridnull/shared-types";
import { DEFAULT_GITHUB_API_URL } from "@gridnull/shared-types";
import { VcsProvider } from "@gridnull/db";
import { VcsApiError } from "./errors";

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

export async function fetchGitHubReposPage(
  params: FetchGitHubReposParams,
  fetchImpl: FetchFn = fetch,
): Promise<GitHubReposPage> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 100;
  const baseUrl = normalizeBaseUrl(params.baseUrl ?? DEFAULT_GITHUB_API_URL);
  const url = new URL("/user/repos", `${baseUrl}/`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");

  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new VcsApiError(
      `GitHub API request failed with status ${response.status}`,
      response.status,
      VcsProvider.GITHUB,
    );
  }

  const repos = (await response.json()) as GitHubRepoRaw[];

  return {
    repos,
    hasNextPage: parseHasNextPage(response.headers.get("link")),
    currentPage: page,
  };
}

const MAX_GITHUB_REPO_PAGES = 5;

export async function fetchAllGitHubRepos(
  params: Omit<FetchGitHubReposParams, "page">,
  fetchImpl: FetchFn = fetch,
): Promise<GitHubRepoRaw[]> {
  const repos: GitHubRepoRaw[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= MAX_GITHUB_REPO_PAGES) {
    const result = await fetchGitHubReposPage(
      { ...params, page },
      fetchImpl,
    );
    repos.push(...result.repos);
    hasNextPage = result.hasNextPage;
    page += 1;
  }

  return repos;
}
