import { describe, expect, it } from "vitest";
import { normalizeGitLabIssue } from "./normalize.js";

describe("normalizeGitLabIssue", () => {
  it("maps GitLab fields including labels", () => {
    const normalized = normalizeGitLabIssue({
      id: 1001,
      iid: 7,
      title: "Bug",
      description: "Details",
      state: "opened",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      closed_at: null,
      author: { username: "alice" },
      assignee: { username: "bob" },
      labels: ["bug", "checkout"],
      weight: 3,
      milestone: null,
    });

    expect(normalized).toMatchObject({
      externalIssueId: 1001,
      issueNumber: 7,
      title: "Bug",
      state: "open",
      labels: ["bug", "checkout"],
      weight: 3,
    });
  });
});
