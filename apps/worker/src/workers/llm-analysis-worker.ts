import {
  IssueState,
  IssueSuggestionStatus,
  IssueSuggestionType,
  SyncStatus,
  prisma,
} from "@gridnull/db";
import type { LlmAnalysisJobPayload } from "@gridnull/shared-types";
import type { Job } from "bullmq";
import { getOllamaConfig, chat, embed } from "../lib/ollama/client.js";
import { acquireLock, startLockHeartbeat } from "../lib/lock.js";
import { getRedis } from "../lib/redis.js";
import { planAnalysisProgress } from "../lib/llm/analysis-progress.js";
import { embedIssuesBatched } from "../lib/llm/embeddings.js";
import {
  canonicalPairKey,
  findDuplicateCandidates,
} from "../lib/llm/duplicate-detection.js";
import {
  draftDescriptions,
  filterIssuesNeedingDescription,
} from "../lib/llm/description-draft.js";

async function updateRunProgress(
  analysisRunId: string,
  data: {
    completedSteps: number;
    progressLabel: string;
    totalSteps?: number;
  },
): Promise<void> {
  await prisma.llmAnalysisRun.update({
    where: { id: analysisRunId },
    data,
  });
}

export async function processLlmAnalysisJob(
  job: Job<LlmAnalysisJobPayload>,
): Promise<void> {
  const { projectId, analysisRunId } = job.data;
  const redis = getRedis();
  const lock = await acquireLock(redis, `llm:${projectId}`, 1800);

  if (!lock) {
    await prisma.llmAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        errorMessage:
          "Could not acquire analysis lock — another run may still be active.",
        progressLabel: "Interrupted",
      },
    });
    return;
  }

  const ollamaConfig = getOllamaConfig();
  const stopHeartbeat = startLockHeartbeat(redis, lock, 1800);

  try {
    const openIssues = await prisma.issue.findMany({
      where: { projectId, state: IssueState.OPEN },
      include: {
        labels: {
          include: { label: { select: { name: true } } },
        },
      },
      orderBy: { gitlabIssueIid: "asc" },
    });

    const issuesForDescription = openIssues.map((issue) => ({
      id: issue.id,
      gitlabIssueIid: issue.gitlabIssueIid,
      title: issue.title,
      description: issue.description,
      labels: issue.labels.map((entry) => entry.label.name),
    }));

    const descriptionTargets =
      filterIssuesNeedingDescription(issuesForDescription);
    const progressPlan = planAnalysisProgress(
      openIssues.length,
      descriptionTargets.length,
    );

    await prisma.llmAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        status: SyncStatus.RUNNING,
        totalSteps: progressPlan.totalSteps,
        completedSteps: 0,
        progressLabel:
          openIssues.length > 0
            ? "Embedding issues"
            : "Scanning for duplicates",
      },
    });

    const issuesForEmbedding = openIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
    }));

    const embeddings = await embedIssuesBatched(
      issuesForEmbedding,
      async (texts) => embed({ input: texts }),
      {
        onBatchComplete: async (completedBatches, totalBatches) => {
          await updateRunProgress(analysisRunId, {
            completedSteps: completedBatches,
            progressLabel:
              totalBatches > 1
                ? `Embedding issues (${completedBatches}/${totalBatches})`
                : "Embedding issues",
          });
        },
      },
    );

    await updateRunProgress(analysisRunId, {
      completedSteps: progressPlan.embedBatches,
      progressLabel: "Finding duplicates",
    });

    const existingDuplicateSuggestions = await prisma.issueSuggestion.findMany({
      where: {
        projectId,
        type: IssueSuggestionType.DUPLICATE,
        status: { in: [IssueSuggestionStatus.PENDING, IssueSuggestionStatus.APPLIED] },
      },
      select: { issueId: true, relatedIssueId: true },
    });

    const existingPairs = new Set(
      existingDuplicateSuggestions
        .filter((suggestion) => suggestion.relatedIssueId)
        .map((suggestion) =>
          canonicalPairKey(suggestion.issueId, suggestion.relatedIssueId!),
        ),
    );

    const duplicateCandidates = findDuplicateCandidates(
      openIssues.map((issue) => ({
        id: issue.id,
        gitlabIssueIid: issue.gitlabIssueIid,
        title: issue.title,
      })),
      embeddings,
      existingPairs,
    );

    const duplicateStep = progressPlan.embedBatches + 1;
    await updateRunProgress(analysisRunId, {
      completedSteps: duplicateStep,
      progressLabel:
        descriptionTargets.length > 0
          ? "Drafting descriptions"
          : "Saving suggestions",
    });

    const descriptionDrafts = await draftDescriptions(
      issuesForDescription,
      async (prompt) =>
        chat({
          messages: [{ role: "user", content: prompt }],
        }),
      {
        onDraftComplete: async (completedDrafts, totalDrafts) => {
          await updateRunProgress(analysisRunId, {
            completedSteps: duplicateStep + completedDrafts,
            progressLabel:
              totalDrafts > 0
                ? `Drafting descriptions (${completedDrafts}/${totalDrafts})`
                : "Saving suggestions",
          });
        },
      },
    );

    let suggestionsCreated = 0;

    for (const candidate of duplicateCandidates) {
      await prisma.issueSuggestion.create({
        data: {
          projectId,
          type: IssueSuggestionType.DUPLICATE,
          status: IssueSuggestionStatus.PENDING,
          issueId: candidate.issueId,
          relatedIssueId: candidate.relatedIssueId,
          suggestedText: candidate.suggestedText,
          confidence: candidate.confidence,
          model: ollamaConfig.embedModel,
        },
      });
      suggestionsCreated += 1;
    }

    for (const draft of descriptionDrafts) {
      await prisma.issueSuggestion.create({
        data: {
          projectId,
          type: IssueSuggestionType.DESCRIPTION,
          status: IssueSuggestionStatus.PENDING,
          issueId: draft.issueId,
          suggestedText: draft.suggestedText,
          model: ollamaConfig.chatModel,
        },
      });
      suggestionsCreated += 1;
    }

    await prisma.llmAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        suggestionsCreated,
        completedSteps: progressPlan.totalSteps,
        progressLabel: "Complete",
      },
    });
  } catch (error) {
    await prisma.llmAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  } finally {
    stopHeartbeat();
    await lock.release();
  }
}
