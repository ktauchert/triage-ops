import {
  IssueState,
  IssueSuggestionStatus,
  openAccessToken,
  prisma,
} from "@triage-ops/db";
import type { WriteBackJobPayload } from "@triage-ops/shared-types";
import type { Job } from "bullmq";
import { acquireLock } from "../lib/lock.js";
import { getRedis } from "../lib/redis.js";
import { applySuggestionToVcs } from "../lib/vcs/apply-suggestion.js";

async function markApplyFailed(
  suggestionId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.issueSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: IssueSuggestionStatus.APPLY_FAILED,
      writeBackError: errorMessage,
    },
  });
}

export async function processVcsWriteBackJob(
  job: Job<WriteBackJobPayload>,
): Promise<void> {
  const { projectId, suggestionId } = job.data;
  const redis = getRedis();
  const lock = await acquireLock(redis, `sync:${projectId}`);

  if (!lock) {
    await markApplyFailed(
      suggestionId,
      "Could not acquire project lock — sync or another write-back may be running.",
    );
    return;
  }

  try {
    const suggestion = await prisma.issueSuggestion.findFirst({
      where: { id: suggestionId, projectId },
      include: {
        issue: {
          select: { id: true, gitlabIssueIid: true },
        },
        relatedIssue: {
          select: { id: true, gitlabIssueIid: true },
        },
        project: {
          include: {
            connection: true,
          },
        },
      },
    });

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    if (suggestion.status !== IssueSuggestionStatus.APPLYING) {
      return;
    }

    const connection = suggestion.project.connection;
    const result = await applySuggestionToVcs(
      {
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        accessToken: openAccessToken(connection.accessToken),
        externalProjectId: suggestion.project.externalProjectId,
        pathWithNamespace: suggestion.project.pathWithNamespace,
        type: suggestion.type,
        suggestedText: suggestion.suggestedText,
        issueIid: suggestion.issue.gitlabIssueIid,
        relatedIssueIid: suggestion.relatedIssue?.gitlabIssueIid ?? null,
      },
      {
        primary: suggestion.issue,
        related: suggestion.relatedIssue,
      },
    );

    for (const update of result.localUpdates) {
      await prisma.issue.update({
        where: { id: update.issueId },
        data: {
          ...(update.description !== undefined
            ? { description: update.description }
            : {}),
          ...(update.state === "CLOSED"
            ? {
                state: IssueState.CLOSED,
                closedAt: new Date(),
              }
            : {}),
          syncedAt: new Date(),
        },
      });
    }

    await prisma.issueSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: IssueSuggestionStatus.APPLIED,
        appliedAt: new Date(),
        writeBackError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markApplyFailed(suggestionId, message);
    throw error;
  } finally {
    await lock.release();
  }
}
