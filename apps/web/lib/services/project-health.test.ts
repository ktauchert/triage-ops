import { describe, expect, it } from "vitest";
import { buildProjectHealthSignals } from "./project-health";

const now = new Date("2026-06-23T12:00:00.000Z");

describe("buildProjectHealthSignals", () => {
  it("reports sync OK when recently synced", () => {
    const signals = buildProjectHealthSignals({
      lastSyncedAt: new Date("2026-06-22T12:00:00.000Z"),
      latestSyncStatus: "COMPLETED",
      latestAnalysisStatus: null,
      pendingSuggestions: 0,
      failedWriteBacks: 0,
      now,
    });

    expect(signals.find((signal) => signal.id === "sync")).toEqual({
      id: "sync",
      tone: "ok",
      label: "Sync OK",
    });
  });

  it("reports stale sync when last sync is older than threshold", () => {
    const signals = buildProjectHealthSignals({
      lastSyncedAt: new Date("2026-06-01T12:00:00.000Z"),
      latestSyncStatus: "COMPLETED",
      latestAnalysisStatus: null,
      pendingSuggestions: 0,
      failedWriteBacks: 0,
      now,
    });

    expect(signals.find((signal) => signal.id === "sync")?.label).toBe(
      "Sync stale",
    );
  });

  it("includes pending suggestions and failed write-back warnings", () => {
    const signals = buildProjectHealthSignals({
      lastSyncedAt: new Date("2026-06-22T12:00:00.000Z"),
      latestSyncStatus: "COMPLETED",
      latestAnalysisStatus: "COMPLETED",
      pendingSuggestions: 2,
      failedWriteBacks: 1,
      now,
    });

    expect(signals.map((signal) => signal.id)).toEqual([
      "sync",
      "analysis",
      "suggestions",
      "writeback",
    ]);
  });

  it("reports running and failed job states", () => {
    const running = buildProjectHealthSignals({
      lastSyncedAt: null,
      latestSyncStatus: "RUNNING",
      latestAnalysisStatus: "PENDING",
      pendingSuggestions: 0,
      failedWriteBacks: 0,
      now,
    });

    expect(running.find((signal) => signal.id === "sync")?.label).toBe(
      "Sync running",
    );
    expect(running.find((signal) => signal.id === "analysis")?.label).toBe(
      "Analysis running",
    );

    const failed = buildProjectHealthSignals({
      lastSyncedAt: new Date("2026-06-22T12:00:00.000Z"),
      latestSyncStatus: "FAILED",
      latestAnalysisStatus: "FAILED",
      pendingSuggestions: 0,
      failedWriteBacks: 0,
      now,
    });

    expect(failed.find((signal) => signal.id === "sync")?.tone).toBe("error");
    expect(failed.find((signal) => signal.id === "analysis")?.tone).toBe(
      "error",
    );
  });
});
