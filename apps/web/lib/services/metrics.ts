import {
  DEFAULT_THRESHOLDS,
  countGhostIssues,
  countZombieIssues,
  getMilestoneDecay,
  type MetricIssue,
  type MetricMilestone,
} from "@triage-ops/metrics";
import { prisma } from "@triage-ops/db";

export type MetricsQuery = {
  ghostDays?: number;
  zombieDays?: number;
};

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
      issues: {
        select: {
          id: true,
          gitlabIssueIid: true,
          title: true,
          state: true,
          assigneeUsername: true,
          lastActivityAt: true,
          milestoneId: true,
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

  const ghostDays = query.ghostDays ?? DEFAULT_THRESHOLDS.ghostDays;
  const zombieDays = query.zombieDays ?? DEFAULT_THRESHOLDS.zombieDays;
  const now = new Date();

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

  const ghost = countGhostIssues(issues, ghostDays, now);
  const zombie = countZombieIssues(issues, zombieDays, now);
  const milestoneDecay = getMilestoneDecay(milestones, issues, now);

  return {
    projectId: project.id,
    projectName: project.name,
    lastSyncedAt: project.lastSyncedAt,
    computedAt: now.toISOString(),
    thresholds: { ghostDays, zombieDays },
    ghost: {
      count: ghost.count,
      issues: ghost.issues,
    },
    zombie: {
      count: zombie.count,
      issues: zombie.issues,
    },
    milestoneDecay: {
      count: milestoneDecay.count,
      milestones: milestoneDecay.milestones,
    },
  };
}
