import {
  IssueState,
  SyncStatus,
  prisma,
} from "@triage-ops/db";
import type { SyncJobPayload } from "@triage-ops/shared-types";
import type { Job } from "bullmq";
import { acquireLock } from "../lib/lock.js";
import { getRedis } from "../lib/redis.js";
import { fetchProjectIssues } from "../lib/vcs/fetch-project-issues.js";

function mapIssueState(state: "open" | "closed"): IssueState {
  return state === "open" ? IssueState.OPEN : IssueState.CLOSED;
}

export async function processSyncJob(job: Job<SyncJobPayload>): Promise<void> {
  const { projectId, syncRunId } = job.data;
  const redis = getRedis();
  const lock = await acquireLock(redis, `sync:${projectId}`);

  if (!lock) {
    throw new Error(`Sync already in progress for project ${projectId}`);
  }

  try {
    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status: SyncStatus.RUNNING },
    });

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { connection: true },
    });

    let page = 1;
    let hasMore = true;
    let issuesSynced = 0;

    while (hasMore) {
      const result = await fetchProjectIssues({
        provider: project.connection.provider,
        baseUrl: project.connection.baseUrl,
        accessToken: project.connection.accessToken,
        externalProjectId: project.externalProjectId,
        pathWithNamespace: project.pathWithNamespace,
        page,
        perPage: 100,
      });

      for (const issue of result.issues) {
        await prisma.issue.upsert({
          where: {
            projectId_gitlabIssueIid: {
              projectId,
              gitlabIssueIid: issue.issueNumber,
            },
          },
          create: {
            gitlabIssueIid: issue.issueNumber,
            gitlabIssueId: issue.externalIssueId,
            title: issue.title,
            description: issue.description,
            state: mapIssueState(issue.state),
            authorUsername: issue.authorUsername,
            assigneeUsername: issue.assigneeUsername,
            weight: issue.weight,
            createdAt: new Date(issue.createdAt),
            updatedAt: new Date(issue.updatedAt),
            closedAt: issue.closedAt ? new Date(issue.closedAt) : null,
            lastActivityAt: new Date(issue.updatedAt),
            projectId,
          },
          update: {
            title: issue.title,
            description: issue.description,
            state: mapIssueState(issue.state),
            authorUsername: issue.authorUsername,
            assigneeUsername: issue.assigneeUsername,
            weight: issue.weight,
            updatedAt: new Date(issue.updatedAt),
            closedAt: issue.closedAt ? new Date(issue.closedAt) : null,
            lastActivityAt: new Date(issue.updatedAt),
            syncedAt: new Date(),
          },
        });
        issuesSynced += 1;
      }

      hasMore = result.hasMore;
      page += 1;
      await job.updateProgress(hasMore ? Math.min(95, page * 10) : 100);
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { lastSyncedAt: new Date() },
    });

    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        issuesSynced,
      },
    });
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRunId },
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
