export const DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD = 0.82;

export type IssueForDuplicateDetection = {
  id: string;
  gitlabIssueIid: number;
  title: string;
};

export type DuplicateCandidate = {
  issueId: string;
  relatedIssueId: string;
  issueIid: number;
  relatedIssueIid: number;
  confidence: number;
  suggestedText: string;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function canonicalPairKey(issueIdA: string, issueIdB: string): string {
  return issueIdA < issueIdB ? `${issueIdA}:${issueIdB}` : `${issueIdB}:${issueIdA}`;
}

export function findDuplicateCandidates(
  issues: IssueForDuplicateDetection[],
  embeddings: Map<string, number[]>,
  existingPairs: Set<string>,
  threshold = DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < issues.length; i += 1) {
    const issueA = issues[i];
    if (!issueA) {
      continue;
    }
    const vectorA = embeddings.get(issueA.id);
    if (!vectorA) {
      continue;
    }

    for (let j = i + 1; j < issues.length; j += 1) {
      const issueB = issues[j];
      if (!issueB) {
        continue;
      }
      const vectorB = embeddings.get(issueB.id);
      if (!vectorB) {
        continue;
      }

      const pairKey = canonicalPairKey(issueA.id, issueB.id);
      if (existingPairs.has(pairKey) || seenPairs.has(pairKey)) {
        continue;
      }

      const confidence = cosineSimilarity(vectorA, vectorB);
      if (confidence < threshold) {
        continue;
      }

      seenPairs.add(pairKey);
      candidates.push({
        issueId: issueA.id,
        relatedIssueId: issueB.id,
        issueIid: issueA.gitlabIssueIid,
        relatedIssueIid: issueB.gitlabIssueIid,
        confidence,
        suggestedText: `Possible duplicate of #${issueB.gitlabIssueIid} "${issueB.title}"`,
      });
    }
  }

  return candidates.sort((left, right) => right.confidence - left.confidence);
}
