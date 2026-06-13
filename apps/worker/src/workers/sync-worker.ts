import {
  IssueState,
  SyncStatus,
  prisma,
} from "@triage-ops/db";
import type { SyncJobPayload } from "@triage-ops/shared-types";
import type { Job } from "bullmq";
import { fetchGitLabIssues } from "../lib/gitlab/client.js";
import { acquireLock } from "../lib/lock.js";
import { getRedis } from "../lib/redis.js";

function mapIssueState(state: "opened" | "closed"): IssueState {
  return state === "opened" ? IssueState.OPEN : IssueState.CLOSED;
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
    let totalPages = 1;
    let issuesSynced = 0;

    while (page <= totalPages) {
      const result = await fetchGitLabIssues({
        baseUrl: project.connection.baseUrl,
        accessToken: project.connection.accessToken,
        gitlabProjectId: project.gitlabProjectId,
        page,
        perPage: 100,
      });

      totalPages = result.totalPages;

      for (const issue of result.issues) {
        await prisma.issue.upsert({
          where: {
            projectId_gitlabIssueIid: {
              projectId,
              gitlabIssueIid: issue.iid,
            },
          },
          create: {
            gitlabIssueIid: issue.iid,
            gitlabIssueId: issue.id,
            title: issue.title,
            description: issue.description,
            state: mapIssueState(issue.state),
            authorUsername: issue.author.username,
            assigneeUsername: issue.assignee?.username ?? null,
            weight: issue.weight,
            createdAt: new Date(issue.created_at),
            updatedAt: new Date(issue.updated_at),
            closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
            lastActivityAt: new Date(issue.updated_at),
            projectId,
          },
          update: {
            title: issue.title,
            description: issue.description,
            state: mapIssueState(issue.state),
            authorUsername: issue.author.username,
            assigneeUsername: issue.assignee?.username ?? null,
            weight: issue.weight,
            updatedAt: new Date(issue.updated_at),
            closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
            lastActivityAt: new Date(issue.updated_at),
            syncedAt: new Date(),
          },
        });
        issuesSynced += 1;
      }

      page += 1;
      await job.updateProgress(Math.round(((page - 1) / totalPages) * 100));
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
