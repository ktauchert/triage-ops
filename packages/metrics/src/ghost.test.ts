import { describe, expect, it } from "vitest";
import { countGhostIssues } from "./ghost";
import type { MetricIssue } from "./types";

const now = new Date("2026-06-13T12:00:00Z");

function issue(overrides: Partial<MetricIssue> = {}): MetricIssue {
  return {
    id: "issue-1",
    gitlabIssueIid: 1,
    title: "Stale bug",
    state: "OPEN",
    assigneeUsername: null,
    lastActivityAt: new Date("2026-05-01T00:00:00Z"),
    milestoneId: null,
    ...overrides,
  };
}

describe("countGhostIssues", () => {
  it("returns zero for empty input", () => {
    expect(countGhostIssues([], 30, now)).toEqual({ count: 0, issues: [] });
  });

  it("counts open issues inactive beyond threshold", () => {
    const result = countGhostIssues([issue()], 30, now);
    expect(result.count).toBe(1);
    expect(result.issues[0]?.gitlabIssueIid).toBe(1);
  });

  it("excludes closed issues", () => {
    const result = countGhostIssues(
      [issue({ state: "CLOSED" })],
      30,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("excludes issues at exactly the threshold boundary", () => {
    const result = countGhostIssues(
      [issue({ lastActivityAt: new Date("2026-05-14T12:00:00Z") })],
      30,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("includes issues with null lastActivityAt", () => {
    const result = countGhostIssues(
      [issue({ lastActivityAt: null })],
      30,
      now,
    );
    expect(result.count).toBe(1);
  });

  it("rejects negative threshold", () => {
    expect(() => countGhostIssues([], -1, now)).toThrow(
      "thresholdDays must be non-negative",
    );
  });
});
