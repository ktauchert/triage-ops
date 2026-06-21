export type IssueForEmbedding = {
  id: string;
  title: string;
  description: string | null;
};

export const DEFAULT_EMBED_BATCH_SIZE = 8;

export function buildIssueEmbeddingText(issue: IssueForEmbedding): string {
  const description = issue.description?.trim() ?? "";
  if (description) {
    return `${issue.title}\n\n${description}`;
  }
  return issue.title;
}

export function buildEmbeddingTexts(issues: IssueForEmbedding[]): string[] {
  return issues.map(buildIssueEmbeddingText);
}

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export async function embedIssues(
  issues: IssueForEmbedding[],
  embedFn: EmbedFn,
): Promise<Map<string, number[]>> {
  return embedIssuesBatched(issues, embedFn, {
    batchSize: Math.max(issues.length, 1),
  });
}

export type EmbedBatchProgress = (
  completedBatches: number,
  totalBatches: number,
) => void | Promise<void>;

export async function embedIssuesBatched(
  issues: IssueForEmbedding[],
  embedFn: EmbedFn,
  options?: {
    batchSize?: number;
    onBatchComplete?: EmbedBatchProgress;
  },
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  if (issues.length === 0) {
    return result;
  }

  const batchSize = options?.batchSize ?? DEFAULT_EMBED_BATCH_SIZE;
  const totalBatches = Math.ceil(issues.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const batch = issues.slice(
      batchIndex * batchSize,
      batchIndex * batchSize + batchSize,
    );
    const texts = buildEmbeddingTexts(batch);
    const vectors = await embedFn(texts);

    for (let index = 0; index < batch.length; index += 1) {
      const issue = batch[index];
      const vector = vectors[index];
      if (issue && vector) {
        result.set(issue.id, vector);
      }
    }

    await options?.onBatchComplete?.(batchIndex + 1, totalBatches);
  }

  return result;
}
