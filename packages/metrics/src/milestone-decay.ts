import type {
  MetricIssue,
  MetricIssueSummary,
  MetricMilestone,
  MilestoneDecayEntry,
} from "./types";

export type MilestoneDecayResult = {
  count: number;
  milestones: MilestoneDecayEntry[];
};

export function getMilestoneDecay(
  milestones: MetricMilestone[],
  issues: MetricIssue[],
  now: Date = new Date(),
): MilestoneDecayResult {
  const openIssuesByMilestone = new Map<string, MetricIssue[]>();

  for (const issue of issues) {
    if (issue.state !== "OPEN" || issue.milestoneId === null) {
      continue;
    }

    const bucket = openIssuesByMilestone.get(issue.milestoneId) ?? [];
    bucket.push(issue);
    openIssuesByMilestone.set(issue.milestoneId, bucket);
  }

  const decayed = milestones
    .filter(
      (milestone) =>
        milestone.state === "ACTIVE" &&
        milestone.dueDate !== null &&
        milestone.dueDate < now,
    )
    .map((milestone) => {
      const milestoneIssues = openIssuesByMilestone.get(milestone.id) ?? [];

      return {
        milestone: {
          id: milestone.id,
          title: milestone.title,
          dueDate: milestone.dueDate,
        },
        openIssueCount: milestoneIssues.length,
        issues: milestoneIssues.map(toIssueSummary),
      };
    })
    .filter((entry) => entry.openIssueCount > 0);

  return {
    count: decayed.length,
    milestones: decayed,
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
