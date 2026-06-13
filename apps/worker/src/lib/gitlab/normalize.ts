import type { GitLabIssueRaw, NormalizedIssue } from "@triage-ops/shared-types";

export function normalizeGitLabIssue(issue: GitLabIssueRaw): NormalizedIssue {
  return {
    externalIssueId: issue.id,
    issueNumber: issue.iid,
    title: issue.title,
    description: issue.description,
    state: issue.state === "opened" ? "open" : "closed",
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    authorUsername: issue.author.username,
    assigneeUsername: issue.assignee?.username ?? null,
    weight: issue.weight,
  };
}
