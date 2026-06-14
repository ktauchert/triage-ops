import { describe, expect, it } from "vitest";
import { MilestoneState } from "@triage-ops/db";
import { mapMilestoneState, parseMilestoneDueDate } from "./milestone.js";

describe("parseMilestoneDueDate", () => {
  it("parses ISO date strings", () => {
    const parsed = parseMilestoneDueDate("2026-06-01");
    expect(parsed?.toISOString().startsWith("2026-06-01")).toBe(true);
  });

  it("returns null for empty values", () => {
    expect(parseMilestoneDueDate(null)).toBeNull();
  });
});

describe("mapMilestoneState", () => {
  it("maps open milestones to ACTIVE", () => {
    expect(mapMilestoneState("open")).toBe(MilestoneState.ACTIVE);
  });

  it("maps closed milestones to CLOSED", () => {
    expect(mapMilestoneState("closed")).toBe(MilestoneState.CLOSED);
  });
});
