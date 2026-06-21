import { describe, expect, it } from "vitest";
import { planAnalysisProgress } from "./analysis-progress.js";

describe("planAnalysisProgress", () => {
  it("counts embed batches, duplicate scan, and description drafts", () => {
    // 17 open issues → 3 batches of 8 + 1 duplicate step + 3 descriptions
    expect(planAnalysisProgress(17, 3, 8)).toEqual({
      embedBatches: 3,
      descriptionSteps: 3,
      totalSteps: 7,
    });
  });

  it("returns zero steps when there are no open issues", () => {
    expect(planAnalysisProgress(0, 0)).toEqual({
      embedBatches: 0,
      descriptionSteps: 0,
      totalSteps: 1,
    });
  });
});
