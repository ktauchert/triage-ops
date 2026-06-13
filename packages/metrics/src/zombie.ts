import type { MetricIssue, MetricIssueSummary } from "./types";
import { isInactiveSince } from "./utils";

export type ZombieIssuesResult = {
  count: number;
  issues: MetricIssueSummary[];
};

export function countZombieIssues(
  issues: MetricIssue[],
  thresholdDays: number,
  now: Date = new Date(),
): ZombieIssuesResult {
  if (thresholdDays < 0) {
    throw new Error("thresholdDays must be non-negative");
  }

  const matches = issues.filter(
    (issue) =>
      issue.state === "OPEN" &&
      issue.assigneeUsername !== null &&
      issue.milestoneId === null &&
      isInactiveSince(issue.lastActivityAt, thresholdDays, now),
  );

  return {
    count: matches.length,
    issues: matches.map((issue) => ({
      id: issue.id,
      gitlabIssueIid: issue.gitlabIssueIid,
      title: issue.title,
      lastActivityAt: issue.lastActivityAt,
    })),
  };
}
