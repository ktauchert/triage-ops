import {
  IssueSuggestionStatus,
  SyncStatus,
  prisma,
} from "@triage-ops/db";
import { getProjectById } from "@/lib/services/projects";
import type { AuthContext } from "@/lib/auth/session";

const suggestionInclude = {
  issue: {
    select: {
      id: true,
      gitlabIssueIid: true,
      title: true,
    },
  },
  relatedIssue: {
    select: {
      id: true,
      gitlabIssueIid: true,
      title: true,
    },
  },
} as const;

export async function listSuggestions(
  ctx: AuthContext,
  projectId: string,
  status?: IssueSuggestionStatus,
) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  return prisma.issueSuggestion.findMany({
    where: {
      projectId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: suggestionInclude,
  });
}

export async function getLatestAnalysisRun(
  ctx: AuthContext,
  projectId: string,
) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  return prisma.llmAnalysisRun.findFirst({
    where: { projectId },
    orderBy: { startedAt: "desc" },
  });
}

export async function triggerLlmAnalysis(ctx: AuthContext, projectId: string) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  const running = await prisma.llmAnalysisRun.findFirst({
    where: {
      projectId,
      status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] },
    },
    orderBy: { startedAt: "desc" },
  });

  if (running) {
    return { analysisRun: running, alreadyRunning: true as const };
  }

  const analysisRun = await prisma.llmAnalysisRun.create({
    data: {
      projectId,
      status: SyncStatus.PENDING,
    },
  });

  return { analysisRun, alreadyRunning: false as const };
}

export type UpdateSuggestionStatusInput = {
  status: "DISMISSED" | "APPLIED";
};

export async function updateSuggestionStatus(
  ctx: AuthContext,
  projectId: string,
  suggestionId: string,
  input: UpdateSuggestionStatusInput,
) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  const suggestion = await prisma.issueSuggestion.findFirst({
    where: { id: suggestionId, projectId },
  });

  if (!suggestion) {
    return undefined;
  }

  if (suggestion.status !== IssueSuggestionStatus.PENDING) {
    throw new Error("Only pending suggestions can be updated");
  }

  const now = new Date();

  return prisma.issueSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: input.status,
      reviewedAt: now,
      appliedAt: input.status === "APPLIED" ? now : null,
    },
    include: suggestionInclude,
  });
}

export async function countPendingSuggestions(
  ctx: AuthContext,
  projectId: string,
) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  return prisma.issueSuggestion.count({
    where: {
      projectId,
      status: IssueSuggestionStatus.PENDING,
    },
  });
}
