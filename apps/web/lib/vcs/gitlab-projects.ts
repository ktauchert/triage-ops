import type {
  FetchGitLabProjectsParams,
  GitLabProjectRaw,
  GitLabProjectsPage,
} from "@triage-ops/shared-types";
import { VcsProvider } from "@triage-ops/db";
import { VcsApiError } from "./errors";

export type FetchFn = typeof fetch;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function fetchGitLabProjectsPage(
  params: FetchGitLabProjectsParams,
  fetchImpl: FetchFn = fetch,
): Promise<GitLabProjectsPage> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 100;
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const url = new URL("/api/v4/projects", `${baseUrl}/`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("membership", "true");
  url.searchParams.set("order_by", "last_activity_at");
  url.searchParams.set("sort", "desc");

  const response = await fetchImpl(url.toString(), {
    headers: {
      "PRIVATE-TOKEN": params.accessToken,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new VcsApiError(
      `GitLab API request failed with status ${response.status}`,
      response.status,
      VcsProvider.GITLAB,
    );
  }

  const projects = (await response.json()) as GitLabProjectRaw[];
  const totalPages = parseInt(response.headers.get("x-total-pages") ?? "1", 10);

  return {
    projects,
    totalPages: Number.isNaN(totalPages) ? 1 : totalPages,
    currentPage: page,
  };
}

const MAX_GITLAB_PROJECT_PAGES = 5;

export async function fetchAllGitLabProjects(
  params: Omit<FetchGitLabProjectsParams, "page">,
  fetchImpl: FetchFn = fetch,
): Promise<GitLabProjectRaw[]> {
  const projects: GitLabProjectRaw[] = [];
  let page = 1;

  while (page <= MAX_GITLAB_PROJECT_PAGES) {
    const result = await fetchGitLabProjectsPage(
      { ...params, page },
      fetchImpl,
    );
    projects.push(...result.projects);

    if (page >= result.totalPages) {
      break;
    }

    page += 1;
  }

  return projects;
}
