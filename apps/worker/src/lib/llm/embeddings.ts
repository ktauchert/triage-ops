export type IssueForEmbedding = {
  id: string;
  title: string;
  description: string | null;
};

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
  if (issues.length === 0) {
    return new Map();
  }

  const texts = buildEmbeddingTexts(issues);
  const vectors = await embedFn(texts);

  const result = new Map<string, number[]>();
  for (let index = 0; index < issues.length; index += 1) {
    const issue = issues[index];
    const vector = vectors[index];
    if (issue && vector) {
      result.set(issue.id, vector);
    }
  }

  return result;
}
