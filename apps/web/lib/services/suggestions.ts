import {
  IssueSuggestionStatus,
  IssueSuggestionType,
  SyncStatus,
  prisma,
} from "@triage-ops/db";
import type { LlmAnalysisRun } from "@prisma/client";
import { getProjectById } from "@/lib/services/projects";
import type { AuthContext } from "@/lib/auth/session";
import { isLockHeld, forceReleaseLock } from "@/lib/lock";
import { enqueueWriteBackJob } from "@/lib/queue";
import { getRedis } from "@/lib/redis";

export const PANEL_SUGGESTION_STATUSES = [
  IssueSuggestionStatus.PENDING,
  IssueSuggestionStatus.APPLYING,
  IssueSuggestionStatus.APPLY_FAILED,
] as const;

const INTERRUPTED_MESSAGE =
  "Analysis interrupted (worker stopped or timed out).";

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

/** Fail orphaned runs when no worker holds the project lock (e.g. after Ctrl+C). */
export async function reconcileStaleLlmRuns(projectId: string): Promise<void> {
  let lockHeld = false;

  try {
    lockHeld = await isLockHeld(getRedis(), `llm:${projectId}`);
  } catch {
    // Redis unavailable — treat as no active worker so stale runs can be cleared.
    lockHeld = false;
  }

  if (lockHeld) {
    return;
  }

  await prisma.llmAnalysisRun.updateMany({
    where: {
      projectId,
      status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] },
    },
    data: {
      status: SyncStatus.FAILED,
      completedAt: new Date(),
      errorMessage: INTERRUPTED_MESSAGE,
      progressLabel: "Interrupted",
    },
  });
}

export async function triggerLlmAnalysis(ctx: AuthContext, projectId: string) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  await reconcileStaleLlmRuns(projectId);

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

function validateApplySuggestion(suggestion: {
  type: IssueSuggestionType;
  suggestedText: string | null;
  relatedIssueId: string | null;
}): void {
  if (suggestion.type === IssueSuggestionType.DESCRIPTION) {
    if (!suggestion.suggestedText?.trim()) {
      throw new Error("Description suggestion is missing suggested text");
    }
    return;
  }

  if (!suggestion.relatedIssueId) {
    throw new Error("Duplicate suggestion is missing related issue");
  }
}

export type UpdateSuggestionStatusResult = {
  suggestion: NonNullable<Awaited<ReturnType<typeof listSuggestions>>>[number];
  queued: boolean;
};

export async function updateSuggestionStatus(
  ctx: AuthContext,
  projectId: string,
  suggestionId: string,
  input: UpdateSuggestionStatusInput,
): Promise<UpdateSuggestionStatusResult | null | undefined> {
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

  const now = new Date();

  if (input.status === "DISMISSED") {
    if (suggestion.status !== IssueSuggestionStatus.PENDING) {
      throw new Error("Only pending suggestions can be dismissed");
    }

    const updated = await prisma.issueSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: IssueSuggestionStatus.DISMISSED,
        reviewedAt: now,
        appliedAt: null,
        writeBackError: null,
      },
      include: suggestionInclude,
    });

    return { suggestion: updated, queued: false };
  }

  if (
    suggestion.status !== IssueSuggestionStatus.PENDING &&
    suggestion.status !== IssueSuggestionStatus.APPLY_FAILED
  ) {
    throw new Error("Only pending or failed suggestions can be applied");
  }

  validateApplySuggestion(suggestion);

  const updated = await prisma.issueSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: IssueSuggestionStatus.APPLYING,
      reviewedAt: now,
      appliedAt: null,
      writeBackError: null,
    },
    include: suggestionInclude,
  });

  await enqueueWriteBackJob({ projectId, suggestionId });

  return { suggestion: updated, queued: true };
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

export type AnalysisPanelData = {
  analysisRun: LlmAnalysisRun | null;
  pendingCount: number;
  suggestions: NonNullable<Awaited<ReturnType<typeof listSuggestions>>>;
};

export async function getAnalysisPanelData(
  ctx: AuthContext,
  projectId: string,
): Promise<AnalysisPanelData | null> {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  await reconcileStaleLlmRuns(projectId);

  const [suggestions, pendingCount, analysisRun] = await Promise.all([
    prisma.issueSuggestion.findMany({
      where: {
        projectId,
        status: { in: [...PANEL_SUGGESTION_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      include: suggestionInclude,
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

  return { analysisRun, pendingCount, suggestions };
}

export type ClearProjectAnalysisResult =
  | { cleared: true; suggestionsDeleted: number; runsDeleted: number }
  | { cleared: false; reason: string };

export async function clearProjectAnalysis(
  ctx: AuthContext,
  projectId: string,
): Promise<ClearProjectAnalysisResult | null> {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  let lockHeld = false;
  try {
    lockHeld = await isLockHeld(getRedis(), `llm:${projectId}`);
  } catch {
    lockHeld = false;
  }

  if (lockHeld) {
    return { cleared: false, reason: "Analysis is in progress" };
  }

  const activeRun = await prisma.llmAnalysisRun.findFirst({
    where: {
      projectId,
      status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] },
    },
  });

  if (activeRun) {
    return { cleared: false, reason: "Analysis is in progress" };
  }

  const applyingSuggestion = await prisma.issueSuggestion.findFirst({
    where: {
      projectId,
      status: IssueSuggestionStatus.APPLYING,
    },
  });

  if (applyingSuggestion) {
    return {
      cleared: false,
      reason: "A suggestion is being applied to VCS",
    };
  }

  const [suggestionsDeleted, runsDeleted] = await prisma.$transaction([
    prisma.issueSuggestion.deleteMany({ where: { projectId } }),
    prisma.llmAnalysisRun.deleteMany({ where: { projectId } }),
  ]);

  try {
    await forceReleaseLock(getRedis(), `llm:${projectId}`);
  } catch {
    // Best-effort lock cleanup after deleting analysis data.
  }

  return {
    cleared: true,
    suggestionsDeleted: suggestionsDeleted.count,
    runsDeleted: runsDeleted.count,
  };
}
