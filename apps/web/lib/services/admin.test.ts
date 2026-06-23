import { describe, expect, it } from "vitest";
import { UserRole } from "@triage-ops/db";
import { countUsersByRole, mergeJobFailures } from "./admin";
import type { AdminJobFailure } from "./admin";

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
