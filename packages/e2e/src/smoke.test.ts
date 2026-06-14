import { SyncStatus, VcsProvider, prisma } from "@triage-ops/db";
import {
  DEFAULT_GITHUB_API_URL,
  QUEUE_NAMES,
  type SyncJobPayload,
} from "@triage-ops/shared-types";
import { Worker } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getProjectMetrics } from "@/lib/services/metrics";
import { closeRedis } from "../../../apps/worker/src/lib/redis.js";
import { createSyncQueue } from "../../../apps/worker/src/queues/sync-queue.js";
import {
  githubIssuesHandler,
  server,
} from "../../../apps/worker/src/test/msw-server.js";
import { processSyncJob } from "../../../apps/worker/src/workers/sync-worker.js";

const SMOKE_CONNECTION_NAME = "e2e-smoke-github";
const SMOKE_OWNER = "smoke-org";
const SMOKE_REPO = "smoke-repo";
const SMOKE_REPO_PATH = `${SMOKE_OWNER}/${SMOKE_REPO}`;

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function buildSmokeIssues() {
  return [
    {
      id: 9_001_001,
      number: 1,
      title: "Ghost issue",
      body: "No activity for weeks",
      state: "open" as const,
      created_at: daysAgoIso(90),
      updated_at: daysAgoIso(45),
      closed_at: null,
      user: { login: "alice" },
      assignee: null,
      labels: [],
      milestone: null,
    },
    {
      id: 9_001_002,
      number: 2,
      title: "Zombie issue",
      body: "Assigned but stale",
      state: "open" as const,
      created_at: daysAgoIso(60),
      updated_at: daysAgoIso(20),
      closed_at: null,
      user: { login: "alice" },
      assignee: { login: "bob" },
      labels: [],
      milestone: null,
    },
    {
      id: 9_001_003,
      number: 3,
      title: "Milestone decay issue",
      body: "Blocked on overdue sprint",
      state: "open" as const,
      created_at: daysAgoIso(40),
      updated_at: daysAgoIso(5),
      closed_at: null,
      user: { login: "alice" },
      assignee: { login: "carol" },
      labels: [],
      milestone: {
        id: 42,
        title: "Overdue Sprint",
        due_on: daysAgoIso(30).slice(0, 10),
        state: "open" as const,
      },
    },
    {
      id: 9_001_004,
      number: 4,
      title: "Closed issue",
      body: "Done",
      state: "closed" as const,
      created_at: daysAgoIso(50),
      updated_at: daysAgoIso(10),
      closed_at: daysAgoIso(10),
      user: { login: "alice" },
      assignee: null,
      labels: [],
      milestone: null,
    },
  ];
}

async function waitForSyncRun(syncRunId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });

    if (run?.status === SyncStatus.COMPLETED) {
      return run;
    }

    if (run?.status === SyncStatus.FAILED) {
      throw new Error(run.errorMessage ?? "Sync failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Sync run ${syncRunId} did not complete within ${timeoutMs}ms`);
}

describe("e2e smoke: register → sync → metrics", () => {
  let projectId: string;
  let worker: Worker<SyncJobPayload>;
  let queue: ReturnType<typeof createSyncQueue>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for e2e smoke tests");
    }

    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is required for e2e smoke tests");
    }

    server.use(
      githubIssuesHandler(SMOKE_OWNER, SMOKE_REPO, buildSmokeIssues()),
    );

    await prisma.vcsConnection.deleteMany({
      where: { name: SMOKE_CONNECTION_NAME },
    });

    const connection = await prisma.vcsConnection.create({
      data: {
        name: SMOKE_CONNECTION_NAME,
        provider: VcsProvider.GITHUB,
        baseUrl: DEFAULT_GITHUB_API_URL,
        accessToken: "ghp-e2e-smoke-token",
      },
    });

    const project = await prisma.project.create({
      data: {
        connectionId: connection.id,
        pathWithNamespace: SMOKE_REPO_PATH,
        name: "E2E Smoke Repo",
      },
    });

    projectId = project.id;

    worker = new Worker<SyncJobPayload>(
      QUEUE_NAMES.GITLAB_SYNC,
      processSyncJob,
      {
        connection: {
          url: process.env.REDIS_URL,
          maxRetriesPerRequest: null,
        },
      },
    );

    queue = createSyncQueue();
  });

  afterAll(async () => {
    await worker?.close();
    await queue?.close();
    await closeRedis();
    await prisma.vcsConnection.deleteMany({
      where: { name: SMOKE_CONNECTION_NAME },
    });
    await prisma.$disconnect();
  });

  it("registers a project, syncs via BullMQ, and returns triage metrics", async () => {
    const syncRun = await prisma.syncRun.create({
      data: {
        projectId,
        status: SyncStatus.PENDING,
      },
    });

    await queue.add("sync", {
      projectId,
      syncRunId: syncRun.id,
    });

    const completedRun = await waitForSyncRun(syncRun.id, 20_000);

    expect(completedRun.status).toBe(SyncStatus.COMPLETED);
    expect(completedRun.issuesSynced).toBe(4);

    const metrics = await getProjectMetrics(projectId);

    expect(metrics).not.toBeNull();
    expect(metrics?.overview.totalIssues).toBe(4);
    expect(metrics?.overview.openIssues).toBe(3);
    expect(metrics?.overview.closedIssues).toBe(1);
    expect(metrics?.overview.totalMilestones).toBe(1);
    expect(metrics?.ghost.count).toBeGreaterThanOrEqual(1);
    expect(metrics?.zombie.count).toBeGreaterThanOrEqual(1);
    expect(metrics?.milestoneDecay.count).toBeGreaterThanOrEqual(1);
    expect(metrics?.lastSyncedAt).not.toBeNull();
  });
});
