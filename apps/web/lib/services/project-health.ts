import { IssueSuggestionStatus, prisma } from "@triage-ops/db";

export type ProjectHealthSignal = {
  id: string;
  tone: "ok" | "warning" | "error" | "muted";
  label: string;
};

export type ProjectHealthSource = {
  id: string;
  lastSyncedAt: Date | null;
  syncRuns: Array<{ status: string }>;
};

export type ProjectHealthInput = {
  lastSyncedAt: Date | null;
  latestSyncStatus: string | null;
  latestAnalysisStatus: string | null;
  pendingSuggestions: number;
  failedWriteBacks: number;
  now?: Date;
  syncStaleDays?: number;
};

const RUNNING_SYNC_STATUSES = new Set(["PENDING", "RUNNING"]);
const RUNNING_ANALYSIS_STATUSES = new Set(["PENDING", "RUNNING"]);

export function buildProjectHealthSignals(
  input: ProjectHealthInput,
): ProjectHealthSignal[] {
  const now = input.now ?? new Date();
  const syncStaleDays = input.syncStaleDays ?? 7;
  const signals: ProjectHealthSignal[] = [];

  if (input.latestSyncStatus === "FAILED") {
    signals.push({ id: "sync", tone: "error", label: "Sync failed" });
  } else if (
    input.latestSyncStatus &&
    RUNNING_SYNC_STATUSES.has(input.latestSyncStatus)
  ) {
    signals.push({ id: "sync", tone: "warning", label: "Sync running" });
  } else if (!input.lastSyncedAt) {
    signals.push({ id: "sync", tone: "warning", label: "Never synced" });
  } else {
    const staleMs = syncStaleDays * 24 * 60 * 60 * 1000;
    const ageMs = now.getTime() - input.lastSyncedAt.getTime();

    if (ageMs > staleMs) {
      signals.push({ id: "sync", tone: "warning", label: "Sync stale" });
    } else {
      signals.push({ id: "sync", tone: "ok", label: "Sync OK" });
    }
  }

  if (input.latestAnalysisStatus === "FAILED") {
    signals.push({ id: "analysis", tone: "error", label: "Analysis failed" });
  } else if (
    input.latestAnalysisStatus &&
    RUNNING_ANALYSIS_STATUSES.has(input.latestAnalysisStatus)
  ) {
    signals.push({ id: "analysis", tone: "warning", label: "Analysis running" });
  } else if (input.latestAnalysisStatus === "COMPLETED") {
    signals.push({ id: "analysis", tone: "ok", label: "Analysis OK" });
  }

  if (input.pendingSuggestions > 0) {
    signals.push({
      id: "suggestions",
      tone: "warning",
      label:
        input.pendingSuggestions === 1
          ? "1 suggestion pending"
          : `${input.pendingSuggestions} suggestions pending`,
    });
  }

  if (input.failedWriteBacks > 0) {
    signals.push({
      id: "writeback",
      tone: "error",
      label:
        input.failedWriteBacks === 1
          ? "1 apply failed"
          : `${input.failedWriteBacks} apply failed`,
    });
  }

  return signals;
}

export async function fetchProjectHealthSignals(
  project: ProjectHealthSource,
): Promise<ProjectHealthSignal[]> {
  const [pendingSuggestions, failedWriteBacks, latestAnalysisRun] =
    await Promise.all([
      prisma.issueSuggestion.count({
        where: {
          projectId: project.id,
          status: IssueSuggestionStatus.PENDING,
        },
      }),
      prisma.issueSuggestion.count({
        where: {
          projectId: project.id,
          status: IssueSuggestionStatus.APPLY_FAILED,
        },
      }),
      prisma.llmAnalysisRun.findFirst({
        where: { projectId: project.id },
        orderBy: { startedAt: "desc" },
        select: { status: true },
      }),
    ]);

  const latestSyncRun = project.syncRuns[0] ?? null;

  return buildProjectHealthSignals({
    lastSyncedAt: project.lastSyncedAt,
    latestSyncStatus: latestSyncRun?.status ?? null,
    latestAnalysisStatus: latestAnalysisRun?.status ?? null,
    pendingSuggestions,
    failedWriteBacks,
  });
}

export async function fetchProjectsHealthMap(
  projects: ProjectHealthSource[],
): Promise<Record<string, ProjectHealthSignal[]>> {
  const entries = await Promise.all(
    projects.map(
      async (project) =>
        [project.id, await fetchProjectHealthSignals(project)] as const,
    ),
  );

  return Object.fromEntries(entries);
}
