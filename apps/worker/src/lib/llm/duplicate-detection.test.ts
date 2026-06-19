import { describe, expect, it } from "vitest";
import {
  canonicalPairKey,
  cosineSimilarity,
  findDuplicateCandidates,
} from "./duplicate-detection.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });
});

describe("canonicalPairKey", () => {
  it("orders ids consistently", () => {
    expect(canonicalPairKey("b", "a")).toBe("a:b");
    expect(canonicalPairKey("a", "b")).toBe("a:b");
  });
});

describe("findDuplicateCandidates", () => {
  const issues = [
    { id: "issue-a", gitlabIssueIid: 1, title: "Login fails with SSO" },
    { id: "issue-b", gitlabIssueIid: 2, title: "SSO login error" },
    { id: "issue-c", gitlabIssueIid: 3, title: "Unrelated export bug" },
  ];

  it("finds pairs above threshold", () => {
    const embeddings = new Map<string, number[]>([
      ["issue-a", [1, 0]],
      ["issue-b", [0.99, 0.01]],
      ["issue-c", [0, 1]],
    ]);

    const candidates = findDuplicateCandidates(issues, embeddings, new Set());

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.issueId).toBe("issue-a");
    expect(candidates[0]?.relatedIssueId).toBe("issue-b");
    expect(candidates[0]?.confidence).toBeGreaterThan(0.82);
  });

  it("skips pairs already suggested", () => {
    const embeddings = new Map<string, number[]>([
      ["issue-a", [1, 0]],
      ["issue-b", [0.99, 0.01]],
      ["issue-c", [0, 1]],
    ]);

    const existing = new Set([canonicalPairKey("issue-a", "issue-b")]);
    const candidates = findDuplicateCandidates(issues, embeddings, existing);

    expect(candidates).toHaveLength(0);
  });

  it("dedupes symmetric pairs", () => {
    const embeddings = new Map<string, number[]>([
      ["issue-a", [1, 0]],
      ["issue-b", [0.99, 0.01]],
      ["issue-c", [0, 1]],
    ]);

    const candidates = findDuplicateCandidates(issues, embeddings, new Set());

    expect(candidates).toHaveLength(1);
  });
});
