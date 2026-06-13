import { describe, expect, it } from "vitest";
import type { MetricIssue } from "./types";
import { countZombieIssues } from "./zombie";

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

describe("countZombieIssues", () => {
  it("returns zero for empty input", () => {
    expect(countZombieIssues([], 14, now)).toEqual({ count: 0, issues: [] });
  });

  it("counts assigned open issues without milestone beyond threshold", () => {
    const result = countZombieIssues([issue()], 14, now);
    expect(result.count).toBe(1);
  });

  it("excludes unassigned issues", () => {
    const result = countZombieIssues(
      [issue({ assigneeUsername: null })],
      14,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("excludes issues with a milestone", () => {
    const result = countZombieIssues(
      [issue({ milestoneId: "milestone-1" })],
      14,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("excludes recently updated issues", () => {
    const result = countZombieIssues(
      [issue({ lastActivityAt: new Date("2026-06-12T00:00:00Z") })],
      14,
      now,
    );
    expect(result.count).toBe(0);
  });

  it("rejects negative threshold", () => {
    expect(() => countZombieIssues([], -1, now)).toThrow(
      "thresholdDays must be non-negative",
    );
  });
});
