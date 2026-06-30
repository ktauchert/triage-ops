import {
  countStaleIssues,
  countStuckIssues,
  getMilestoneDecay,
  type MetricIssue,
  type MetricMilestone,
} from "@gridnull/metrics";
import { IssueSuggestionStatus, prisma } from "@gridnull/db";
import { PANEL_SUGGESTION_STATUSES } from "@/lib/services/suggestions";

export type MetricsQuery = {
  staleDays?: number;
  stuckDays?: number;
};

function issueLabels(
  issue: { labels: Array<{ label: { name: string } }> },
): string[] {
  return issue.labels.map((entry) => entry.label.name).sort();
}

function enrichIssueSummary<T extends { id: string }>(
  issue: T,
  labelsByIssueId: Map<string, string[]>,
) {
  return {
    ...issue,
    labels: labelsByIssueId.get(issue.id) ?? [],
  };
}

export async function getProjectMetrics(
  projectId: string,
  query: MetricsQuery = {},
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      lastSyncedAt: true,
      staleThresholdDays: true,
      stuckThresholdDays: true,
      issues: {
        select: {
          id: true,
          gitlabIssueIid: true,
          title: true,
          state: true,
          assigneeUsername: true,
          lastActivityAt: true,
          milestoneId: true,
          labels: {
            select: {
              label: {
                select: { name: true },
              },
            },
          },
        },
      },
      milestones: {
        select: {
          id: true,
          title: true,
          state: true,
          dueDate: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const staleDays = query.staleDays ?? project.staleThresholdDays;
  const stuckDays = query.stuckDays ?? project.stuckThresholdDays;
  const now = new Date();

  const labelsByIssueId = new Map(
    project.issues.map((issue) => [issue.id, issueLabels(issue)]),
  );

  const issues: MetricIssue[] = project.issues.map((issue) => ({
    id: issue.id,
    gitlabIssueIid: issue.gitlabIssueIid,
    title: issue.title,
    state: issue.state,
    assigneeUsername: issue.assigneeUsername,
    lastActivityAt: issue.lastActivityAt,
    milestoneId: issue.milestoneId,
  }));

  const milestones: MetricMilestone[] = project.milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    state: milestone.state,
    dueDate: milestone.dueDate,
  }));

  const openIssues = issues.filter((issue) => issue.state === "OPEN");
  const closedIssues = issues.filter((issue) => issue.state === "CLOSED");
  const activeMilestones = milestones.filter(
    (milestone) => milestone.state === "ACTIVE",
  );

  const stale = countStaleIssues(issues, staleDays, now);
  const stuck = countStuckIssues(issues, stuckDays, now);
  const milestoneDecay = getMilestoneDecay(milestones, issues, now);

  const [panelSuggestions, pendingCount, latestAnalysisRun] =
    await Promise.all([
      prisma.issueSuggestion.findMany({
        where: {
          projectId,
          status: { in: [...PANEL_SUGGESTION_STATUSES] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          issue: {
            select: { id: true, gitlabIssueIid: true, title: true },
          },
          relatedIssue: {
            select: { id: true, gitlabIssueIid: true, title: true },
          },
        },
      }),
      prisma.issueSuggestion.count({
        where: {
          projectId,
          status: IssueSuggestionStatus.PENDING,
        },
      }),
      prisma.llmAnalysisRun.findFirst({
        where: { projectId },
        orderBy: { startedAt: "desc" },
      }),
    ]);

  return {
    projectId: project.id,
    projectName: project.name,
    lastSyncedAt: project.lastSyncedAt,
    computedAt: now.toISOString(),
    thresholds: { staleDays, stuckDays },
    overview: {
      totalIssues: issues.length,
      openIssues: openIssues.length,
      closedIssues: closedIssues.length,
      totalMilestones: milestones.length,
      activeMilestones: activeMilestones.length,
    },
    issues: issues
      .map((issue) =>
        enrichIssueSummary(
          {
            id: issue.id,
            gitlabIssueIid: issue.gitlabIssueIid,
            title: issue.title,
            state: issue.state,
            lastActivityAt: issue.lastActivityAt,
          },
          labelsByIssueId,
        ),
      )
      .sort((a, b) => a.gitlabIssueIid - b.gitlabIssueIid),
    milestones: milestones
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        state: milestone.state,
        dueDate: milestone.dueDate,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    stale: {
      count: stale.count,
      issues: stale.issues.map((issue) =>
        enrichIssueSummary(issue, labelsByIssueId),
      ),
    },
    stuck: {
      count: stuck.count,
      issues: stuck.issues.map((issue) =>
        enrichIssueSummary(issue, labelsByIssueId),
      ),
    },
    milestoneDecay: {
      count: milestoneDecay.count,
      milestones: milestoneDecay.milestones.map((entry) => ({
        ...entry,
        issues: entry.issues.map((issue) =>
          enrichIssueSummary(issue, labelsByIssueId),
        ),
      })),
    },
    suggestions: {
      pendingCount,
      items: panelSuggestions,
      latestAnalysisRun,
    },
  };
}
