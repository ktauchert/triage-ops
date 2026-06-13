import { describe, expect, it } from "vitest";
import { getMilestoneDecay } from "./milestone-decay";
import type { MetricIssue, MetricMilestone } from "./types";

const now = new Date("2026-06-13T12:00:00Z");

describe("getMilestoneDecay", () => {
  it("returns zero for empty input", () => {
    expect(getMilestoneDecay([], [], now)).toEqual({
      count: 0,
      milestones: [],
    });
  });

  it("finds active milestones past due date with open issues", () => {
    const milestones: MetricMilestone[] = [
      {
        id: "m1",
        title: "Sprint 1",
        state: "ACTIVE",
        dueDate: new Date("2026-06-01T00:00:00Z"),
      },
    ];

    const issues: MetricIssue[] = [
      {
        id: "i1",
        gitlabIssueIid: 10,
        title: "Still open",
        state: "OPEN",
        assigneeUsername: "alice",
        lastActivityAt: new Date("2026-06-10T00:00:00Z"),
        milestoneId: "m1",
      },
    ];

    const result = getMilestoneDecay(milestones, issues, now);
    expect(result.count).toBe(1);
    expect(result.milestones[0]?.openIssueCount).toBe(1);
    expect(result.milestones[0]?.issues[0]?.gitlabIssueIid).toBe(10);
  });

  it("ignores milestones without open issues", () => {
    const milestones: MetricMilestone[] = [
      {
        id: "m1",
        title: "Empty sprint",
        state: "ACTIVE",
        dueDate: new Date("2026-06-01T00:00:00Z"),
      },
    ];

    const issues: MetricIssue[] = [
      {
        id: "i1",
        gitlabIssueIid: 11,
        title: "Closed item",
        state: "CLOSED",
        assigneeUsername: null,
        lastActivityAt: new Date("2026-06-10T00:00:00Z"),
        milestoneId: "m1",
      },
    ];

    expect(getMilestoneDecay(milestones, issues, now).count).toBe(0);
  });

  it("ignores milestones not yet due", () => {
    const milestones: MetricMilestone[] = [
      {
        id: "m1",
        title: "Future sprint",
        state: "ACTIVE",
        dueDate: new Date("2026-07-01T00:00:00Z"),
      },
    ];

    const issues: MetricIssue[] = [
      {
        id: "i1",
        gitlabIssueIid: 12,
        title: "Open item",
        state: "OPEN",
        assigneeUsername: null,
        lastActivityAt: new Date("2026-06-10T00:00:00Z"),
        milestoneId: "m1",
      },
    ];

    expect(getMilestoneDecay(milestones, issues, now).count).toBe(0);
  });

  it("ignores closed milestones", () => {
    const milestones: MetricMilestone[] = [
      {
        id: "m1",
        title: "Closed sprint",
        state: "CLOSED",
        dueDate: new Date("2026-06-01T00:00:00Z"),
      },
    ];

    const issues: MetricIssue[] = [
      {
        id: "i1",
        gitlabIssueIid: 13,
        title: "Open item",
        state: "OPEN",
        assigneeUsername: null,
        lastActivityAt: new Date("2026-06-10T00:00:00Z"),
        milestoneId: "m1",
      },
    ];

    expect(getMilestoneDecay(milestones, issues, now).count).toBe(0);
  });
});
