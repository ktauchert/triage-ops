import type { NormalizedIssue } from "@gridnull/shared-types";
import { VcsProvider } from "@gridnull/db";
import { fetchGitHubIssues } from "../github/client.js";
import {
  isGitHubPullRequest,
  normalizeGitHubIssue,
  parseGitHubRepo,
} from "../github/normalize.js";
import { fetchGitLabIssues } from "../gitlab/client.js";
import { normalizeGitLabIssue } from "../gitlab/normalize.js";

export type FetchProjectIssuesParams = {
  provider: VcsProvider;
  baseUrl: string;
  accessToken: string;
  externalProjectId: number | null;
  pathWithNamespace: string;
  page?: number;
  perPage?: number;
};

export type FetchProjectIssuesPage = {
  issues: NormalizedIssue[];
  hasMore: boolean;
  currentPage: number;
};

export async function fetchProjectIssues(
  params: FetchProjectIssuesParams,
): Promise<FetchProjectIssuesPage> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 100;

  if (params.provider === VcsProvider.GITHUB) {
    const { owner, repo } = parseGitHubRepo(params.pathWithNamespace);
    const result = await fetchGitHubIssues({
      accessToken: params.accessToken,
      owner,
      repo,
      baseUrl: params.baseUrl,
      page,
      perPage,
    });

    return {
      issues: result.issues
        .filter((issue) => !isGitHubPullRequest(issue))
        .map(normalizeGitHubIssue),
      hasMore: result.hasNextPage,
      currentPage: result.currentPage,
    };
  }

  if (
    params.externalProjectId === null ||
    !Number.isInteger(params.externalProjectId) ||
    params.externalProjectId <= 0
  ) {
    throw new Error("GitLab projects require a positive externalProjectId");
  }

  const result = await fetchGitLabIssues({
    baseUrl: params.baseUrl,
    accessToken: params.accessToken,
    gitlabProjectId: params.externalProjectId,
    page,
    perPage,
  });

  return {
    issues: result.issues.map(normalizeGitLabIssue),
    hasMore: page < result.totalPages,
    currentPage: result.currentPage,
  };
}
