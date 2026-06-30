import { describe, expect, it } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  countUsersByRole,
  mergeBackgroundJobs,
  mergeJobFailures,
} from "./admin";
import type { AdminBackgroundJob, AdminJobFailure } from "./admin";

describe("countUsersByRole", () => {
  it("aggregates users by role", () => {
    expect(
      countUsersByRole([
        { role: UserRole.ADMIN },
        { role: UserRole.ADMIN },
        { role: UserRole.VIEWER },
        { role: UserRole.LEAD },
      ]),
    ).toEqual({
      ADMIN: 2,
      LEAD: 1,
      OPERATOR: 0,
      VIEWER: 1,
    });
  });
});

describe("mergeJobFailures", () => {
  const failures: AdminJobFailure[] = [
    {
      id: "a",
      kind: "sync",
      projectId: "p1",
      projectName: "Alpha",
      status: "FAILED",
      errorMessage: "sync err",
      occurredAt: new Date("2026-06-20T12:00:00.000Z"),
    },
    {
      id: "b",
      kind: "analysis",
      projectId: "p2",
      projectName: "Beta",
      status: "FAILED",
      errorMessage: "llm err",
      occurredAt: new Date("2026-06-22T12:00:00.000Z"),
    },
  ];

  it("sorts failures newest first and limits results", () => {
    expect(mergeJobFailures(failures, 1)).toEqual([failures[1]]);
  });
});

describe("mergeBackgroundJobs", () => {
  const jobs: AdminBackgroundJob[] = [
    {
      id: "sync-1",
      kind: "sync",
      projectId: "p1",
      projectName: "Alpha",
      status: "COMPLETED",
      startedAt: new Date("2026-06-20T12:00:00.000Z"),
      completedAt: new Date("2026-06-20T12:05:00.000Z"),
      errorMessage: null,
      detail: "10 issues synced",
      appliedByEmail: null,
    },
    {
      id: "analysis-1",
      kind: "analysis",
      projectId: "p2",
      projectName: "Beta",
      status: "RUNNING",
      startedAt: new Date("2026-06-22T12:00:00.000Z"),
      completedAt: null,
      errorMessage: null,
      detail: "2/5 steps",
      appliedByEmail: null,
    },
  ];

  it("sorts jobs newest first and limits results", () => {
    expect(mergeBackgroundJobs(jobs, 1)).toEqual([jobs[1]]);
  });
});
