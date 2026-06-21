import { describe, expect, it } from "vitest";
import {
  duplicateCanonicalComment,
  duplicateCloseComment,
  pickDuplicateSides,
} from "./duplicate-sides.js";

describe("pickDuplicateSides", () => {
  it("treats lower IID as canonical", () => {
    expect(
      pickDuplicateSides({ issueIid: 15, relatedIssueIid: 9 }),
    ).toEqual({ canonicalIid: 9, duplicateIid: 15 });
  });
});

describe("duplicate comments", () => {
  it("formats close and canonical comments", () => {
    expect(duplicateCloseComment(9)).toBe(
      "Closed as duplicate of #9 (applied via TriageOps).",
    );
    expect(duplicateCanonicalComment(15)).toBe(
      "Linked duplicate #15 closed (applied via TriageOps).",
    );
  });
});
