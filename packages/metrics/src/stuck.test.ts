import { describe, expect, it } from "vitest";
import type { MetricIssue } from "./types";
import { countStuckIssues } from "./stuck";

const now = new Date("2026-06-13T12:00:00Z");

function issue(overrides: Partial<MetricIssue> = {}): MetricIssue {
  return {
    id: "issue-1",
    gitlabIssueIid: 2,
    title: "Assigned but stale",
    state: "OPEN",
    assigneeUsername: "bob",
    lastActivityAt: new Date("2026-05-25T00:00:00Z"),
    milestoneId: null,
    ...overrides,
  };
}

describe("countStuckIssues", () => {
  it("returns zero for empty input", () => {
    expect(countStuckIssues([], 14, now)).toEqual({ count: 0, issues: [] });
  });

  it("counts assigned open issues without milestone beyond threshold", () => {
    const result = countStuckIssues([issue()], 14, now);
    expect(result.count).toBe(1);
  });

  it("excludes unassigned issues", () => {
    const result = countStuckIssues(
      [issue({ assigneeUsername: null })],
      14,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("excludes issues with a milestone", () => {
    const result = countStuckIssues(
      [issue({ milestoneId: "milestone-1" })],
      14,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("excludes recently updated issues", () => {
    const result = countStuckIssues(
      [issue({ lastActivityAt: new Date("2026-06-12T00:00:00Z") })],
      14,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("rejects negative threshold", () => {
    expect(() => countStuckIssues([], -1, now)).toThrow(
      "thresholdDays must be non-negative",
    );
  });
});
