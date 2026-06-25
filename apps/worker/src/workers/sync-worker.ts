import {
  IssueState,
  SyncStatus,
  openAccessToken,
  prisma,
} from "@triage-ops/db";
import type { NormalizedIssue, SyncJobPayload } from "@triage-ops/shared-types";
import type { Job } from "bullmq";
import { acquireLock, startLockHeartbeat } from "../lib/lock.js";
import { getRedis } from "../lib/redis.js";
import { fetchProjectIssues } from "../lib/vcs/fetch-project-issues.js";
import {
  mapMilestoneState,
  parseMilestoneDueDate,
} from "../lib/milestone.js";
import { syncIssueLabels } from "../lib/sync-labels.js";

function mapIssueState(state: "open" | "closed"): IssueState {
  return state === "open" ? IssueState.OPEN : IssueState.CLOSED;
}

async function resolveMilestoneId(
  projectId: string,
  milestone: NormalizedIssue["milestone"],
): Promise<string | null> {
  if (!milestone) {
    return null;
  }

  const record = await prisma.milestone.upsert({
    where: {
      projectId_gitlabMilestoneId: {
        projectId,
        gitlabMilestoneId: milestone.externalId,
      },
    },
    create: {
      gitlabMilestoneId: milestone.externalId,
      title: milestone.title,
      state: mapMilestoneState(milestone.state),
      dueDate: parseMilestoneDueDate(milestone.dueDate),
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId,
    },
    update: {
      title: milestone.title,
      state: mapMilestoneState(milestone.state),
      dueDate: parseMilestoneDueDate(milestone.dueDate),
      updatedAt: new Date(),
    },
  });

  return record.id;
}

async function upsertSyncedIssue(
  projectId: string,
  issue: NormalizedIssue,
): Promise<string> {
  const milestoneId = await resolveMilestoneId(projectId, issue.milestone);

  const record = await prisma.issue.upsert({
    where: {
      projectId_gitlabIssueIid: {
        projectId,
        gitlabIssueIid: issue.issueNumber,
      },
    },
    create: {
      gitlabIssueIid: issue.issueNumber,
      gitlabIssueId: BigInt(issue.externalIssueId),
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
      milestoneId,
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
      milestoneId,
      syncedAt: new Date(),
    },
  });

  await syncIssueLabels(projectId, record.id, issue.labels);

  return record.id;
}

export async function processSyncJob(job: Job<SyncJobPayload>): Promise<void> {
  const { projectId, syncRunId } = job.data;
  const redis = getRedis();
  const lock = await acquireLock(redis, `sync:${projectId}`);

  if (!lock) {
    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        errorMessage: `Sync already in progress for project ${projectId}`,
      },
    });
    throw new Error(`Sync already in progress for project ${projectId}`);
  }

  const stopHeartbeat = startLockHeartbeat(redis, lock);

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
        accessToken: openAccessToken(project.connection.accessToken),
        externalProjectId: project.externalProjectId,
        pathWithNamespace: project.pathWithNamespace,
        page,
        perPage: 100,
      });

      for (const issue of result.issues) {
        await upsertSyncedIssue(projectId, issue);
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
    stopHeartbeat();
    await lock.release();
  }
}
