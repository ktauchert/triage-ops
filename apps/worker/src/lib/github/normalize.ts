import type { GitHubIssueRaw, NormalizedIssue } from "@triage-ops/shared-types";

export function isGitHubPullRequest(issue: GitHubIssueRaw): boolean {
  return issue.pull_request !== undefined;
}

export function normalizeGitHubIssue(issue: GitHubIssueRaw): NormalizedIssue {
  return {
    externalIssueId: issue.id,
    issueNumber: issue.number,
    title: issue.title,
    description: issue.body,
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    authorUsername: issue.user.login,
    assigneeUsername: issue.assignee?.login ?? null,
    weight: null,
    labels: issue.labels.map((label) => label.name),
    milestone: issue.milestone
      ? {
          externalId: issue.milestone.id,
          title: issue.milestone.title,
          dueDate: issue.milestone.due_on,
          state: issue.milestone.state,
        }
      : null,
  };
}

export function parseGitHubRepo(pathWithNamespace: string): {
  owner: string;
  repo: string;
} {
  const trimmed = pathWithNamespace.trim();
  const slashIndex = trimmed.indexOf("/");

  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    throw new Error(
      "pathWithNamespace must be in owner/repo format for GitHub projects",
    );
  }

  return {
    owner: trimmed.slice(0, slashIndex),
    repo: trimmed.slice(slashIndex + 1),
  };
}
