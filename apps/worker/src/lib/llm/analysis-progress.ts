import { DEFAULT_EMBED_BATCH_SIZE } from "./embeddings.js";

export type AnalysisProgressPlan = {
  totalSteps: number;
  embedBatches: number;
  descriptionSteps: number;
};

/** Known upfront: embed batches + duplicate scan + one chat call per empty description. */
export function planAnalysisProgress(
  openIssueCount: number,
  emptyDescriptionCount: number,
  batchSize = DEFAULT_EMBED_BATCH_SIZE,
): AnalysisProgressPlan {
  const embedBatches =
    openIssueCount === 0 ? 0 : Math.ceil(openIssueCount / batchSize);
  const duplicateStep = 1;
  const descriptionSteps = emptyDescriptionCount;

  return {
    embedBatches,
    descriptionSteps,
    totalSteps: embedBatches + duplicateStep + descriptionSteps,
  };
}
