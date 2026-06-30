import { MilestoneState } from "@gridnull/db";
import type { NormalizedIssue } from "@gridnull/shared-types";

export function parseMilestoneDueDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapMilestoneState(
  state: NonNullable<NormalizedIssue["milestone"]>["state"],
): MilestoneState {
  return state === "open" ? MilestoneState.ACTIVE : MilestoneState.CLOSED;
}
