export type IssueIidPair = {
  issueIid: number;
  relatedIssueIid: number;
};

export type DuplicateSides = {
  canonicalIid: number;
  duplicateIid: number;
};

/** Lower IID is canonical; higher IID is closed as duplicate. */
export function pickDuplicateSides(pair: IssueIidPair): DuplicateSides {
  const canonicalIid = Math.min(pair.issueIid, pair.relatedIssueIid);
  const duplicateIid = Math.max(pair.issueIid, pair.relatedIssueIid);
  return { canonicalIid, duplicateIid };
}

export function duplicateCloseComment(canonicalIid: number): string {
  return `Closed as duplicate of #${canonicalIid} (applied via TriageOps).`;
}

export function duplicateCanonicalComment(duplicateIid: number): string {
  return `Linked duplicate #${duplicateIid} closed (applied via TriageOps).`;
}
