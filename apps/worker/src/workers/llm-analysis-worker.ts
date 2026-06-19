import {
  IssueState,
  IssueSuggestionStatus,
  IssueSuggestionType,
  SyncStatus,
  prisma,
} from "@triage-ops/db";
import type { LlmAnalysisJobPayload } from "@triage-ops/shared-types";
import type { Job } from "bullmq";
import { getOllamaConfig, chat, embed } from "../lib/ollama/client.js";
import { acquireLock } from "../lib/lock.js";
import { getRedis } from "../lib/redis.js";
import { embedIssues } from "../lib/llm/embeddings.js";
import {
  canonicalPairKey,
  findDuplicateCandidates,
} from "../lib/llm/duplicate-detection.js";
import { draftDescriptions } from "../lib/llm/description-draft.js";

export async function processLlmAnalysisJob(
  job: Job<LlmAnalysisJobPayload>,
): Promise<void> {
  const { projectId, analysisRunId } = job.data;
  const redis = getRedis();
  const lock = await acquireLock(redis, `llm:${projectId}`);

  if (!lock) {
    throw new Error(`LLM analysis already in progress for project ${projectId}`);
  }

  const ollamaConfig = getOllamaConfig();

  try {
    await prisma.llmAnalysisRun.update({
      where: { id: analysisRunId },
      data: { status: SyncStatus.RUNNING },
    });

    const openIssues = await prisma.issue.findMany({
      where: { projectId, state: IssueState.OPEN },
      include: {
        labels: {
          include: { label: { select: { name: true } } },
        },
      },
      orderBy: { gitlabIssueIid: "asc" },
    });

    const issuesForEmbedding = openIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
    }));

    const embeddings = await embedIssues(issuesForEmbedding, async (texts) =>
      embed({ input: texts }),
    );

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

    const descriptionDrafts = await draftDescriptions(
      openIssues.map((issue) => ({
        id: issue.id,
        gitlabIssueIid: issue.gitlabIssueIid,
        title: issue.title,
        description: issue.description,
        labels: issue.labels.map((entry) => entry.label.name),
      })),
      async (prompt) =>
        chat({
          messages: [{ role: "user", content: prompt }],
        }),
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
    await lock.release();
  }
}
