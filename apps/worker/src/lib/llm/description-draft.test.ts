import { describe, expect, it } from "vitest";
import {
  buildDescriptionDraftPrompt,
  draftDescriptions,
  filterIssuesNeedingDescription,
  hasEmptyDescription,
  parseDescriptionDraft,
} from "./description-draft.js";

describe("hasEmptyDescription", () => {
  it("treats null and blank as empty", () => {
    expect(hasEmptyDescription(null)).toBe(true);
    expect(hasEmptyDescription("")).toBe(true);
    expect(hasEmptyDescription("   ")).toBe(true);
  });

  it("accepts non-empty descriptions", () => {
    expect(hasEmptyDescription("Steps to reproduce")).toBe(false);
  });
});

describe("filterIssuesNeedingDescription", () => {
  it("keeps only issues without description", () => {
    const issues = [
      {
        id: "1",
        gitlabIssueIid: 1,
        title: "Add pagination",
        description: null,
        labels: ["enhancement"],
      },
      {
        id: "2",
        gitlabIssueIid: 2,
        title: "Fix login",
        description: "Already documented",
        labels: [],
      },
    ];

    expect(filterIssuesNeedingDescription(issues)).toHaveLength(1);
    expect(filterIssuesNeedingDescription(issues)[0]?.id).toBe("1");
  });
});

describe("buildDescriptionDraftPrompt", () => {
  it("includes title and labels", () => {
    const prompt = buildDescriptionDraftPrompt({
      id: "1",
      gitlabIssueIid: 5,
      title: "Add dark mode",
      description: null,
      labels: ["ux", "enhancement"],
    });

    expect(prompt).toContain("Title: Add dark mode");
    expect(prompt).toContain("Labels: ux, enhancement");
  });
});

describe("parseDescriptionDraft", () => {
  it("trims assistant output", () => {
    expect(parseDescriptionDraft("  Draft body\n")).toBe("Draft body");
  });
});

describe("draftDescriptions", () => {
  it("drafts only for empty-description issues", async () => {
    const issues = [
      {
        id: "1",
        gitlabIssueIid: 1,
        title: "Add pagination",
        description: null,
        labels: ["enhancement"],
      },
      {
        id: "2",
        gitlabIssueIid: 2,
        title: "Fix login",
        description: "Done",
        labels: [],
      },
    ];

    const drafts = await draftDescriptions(issues, async () => "Suggested body");

    expect(drafts).toEqual([{ issueId: "1", suggestedText: "Suggested body" }]);
  });
});
