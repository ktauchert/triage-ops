import {
  countGhostIssues,
  countZombieIssues,
  type MetricIssue,
} from "@triage-ops/metrics";
import { prisma, type UserRole } from "@triage-ops/db";
import type { AuthContext } from "@/lib/auth/session";
import {
  fetchProjectHealthSignals,
  type ProjectHealthSignal,
} from "@/lib/services/project-health";
import { listProjects } from "@/lib/services/projects";

export type HomeProjectCard = {
  id: string;
  name: string;
  pathWithNamespace: string;
  isFavorite: boolean;
  lastSyncedAt: Date | null;
  openIssues: number;
  ghostCount: number;
  zombieCount: number;
  healthSignals: ProjectHealthSignal[];
};

export type HomeSummary = {
  user: {
    name: string | null;
    email: string | null;
    role: UserRole;
  };
  favoriteProjects: HomeProjectCard[];
  totalProjects: number;
  dataScope: AuthContext["dataScope"];
};

export function pickHomeProjectCards<T extends { id: string; isFavorite: boolean }>(
  projects: T[],
): T[] {
  return projects.filter((project) => project.isFavorite);
}

async function buildProjectCard(project: {
  id: string;
  name: string;
  pathWithNamespace: string;
  isFavorite: boolean;
  lastSyncedAt: Date | null;
  ghostThresholdDays: number;
  zombieThresholdDays: number;
  syncRuns: Array<{ status: string }>;
}): Promise<HomeProjectCard> {
  const [issues, healthSignals] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        gitlabIssueIid: true,
        title: true,
        state: true,
        assigneeUsername: true,
        lastActivityAt: true,
        milestoneId: true,
      },
    }),
    fetchProjectHealthSignals(project),
  ]);

  const metricIssues: MetricIssue[] = issues.map((issue) => ({
    id: issue.id,
    gitlabIssueIid: issue.gitlabIssueIid,
    title: issue.title,
    state: issue.state,
    assigneeUsername: issue.assigneeUsername,
    lastActivityAt: issue.lastActivityAt,
    milestoneId: issue.milestoneId,
  }));

  const now = new Date();
  const openIssues = metricIssues.filter((issue) => issue.state === "OPEN");

  return {
    id: project.id,
    name: project.name,
    pathWithNamespace: project.pathWithNamespace,
    isFavorite: project.isFavorite,
    lastSyncedAt: project.lastSyncedAt,
    openIssues: openIssues.length,
    ghostCount: countGhostIssues(
      metricIssues,
      project.ghostThresholdDays,
      now,
    ).count,
    zombieCount: countZombieIssues(
      metricIssues,
      project.zombieThresholdDays,
      now,
    ).count,
    healthSignals,
  };
}

export async function getHomeSummary(ctx: AuthContext): Promise<HomeSummary> {
  const projects = await listProjects(ctx);
  const favoriteProjects = pickHomeProjectCards(projects);

  const cards = await Promise.all(
    favoriteProjects.map((project) => buildProjectCard(project)),
  );

  return {
    user: {
      name: ctx.name ?? null,
      email: ctx.email ?? null,
      role: ctx.role,
    },
    favoriteProjects: cards,
    totalProjects: projects.length,
    dataScope: ctx.dataScope,
  };
}

export function formatUserRole(role: UserRole): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
