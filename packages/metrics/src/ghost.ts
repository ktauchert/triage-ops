import type { MetricIssue, MetricIssueSummary } from "./types";
import { isInactiveSince } from "./utils";

export type GhostIssuesResult = {
  count: number;
  issues: MetricIssueSummary[];
};

export function countGhostIssues(
  issues: MetricIssue[],
  thresholdDays: number,
  now: Date = new Date(),
): GhostIssuesResult {
  if (thresholdDays < 0) {
    throw new Error("thresholdDays must be non-negative");
  }

  const matches = issues.filter(
    (issue) =>
      issue.state === "OPEN" &&
      isInactiveSince(issue.lastActivityAt, thresholdDays, now),
  );

  return {
    count: matches.length,
    issues: matches.map(toIssueSummary),
  };
}

function toIssueSummary(issue: MetricIssue): MetricIssueSummary {
  return {
    id: issue.id,
    gitlabIssueIid: issue.gitlabIssueIid,
    title: issue.title,
    lastActivityAt: issue.lastActivityAt,
  };
}
