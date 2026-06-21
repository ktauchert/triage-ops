import { IssueSuggestionType, VcsProvider } from "@triage-ops/db";
import { describe, expect, it } from "vitest";
import { applySuggestionToVcs } from "./apply-suggestion.js";
import {
  githubIssueCommentHandler,
  githubIssuePatchHandler,
  gitlabIssueNoteHandler,
  gitlabIssueUpdateHandler,
  server,
} from "../../test/msw-server.js";

describe("applySuggestionToVcs", () => {
  it("writes GitLab description suggestions", async () => {
    server.use(gitlabIssueUpdateHandler(42, 15));

    const result = await applySuggestionToVcs(
      {
        provider: VcsProvider.GITLAB,
        baseUrl: "https://gitlab.example.com",
        accessToken: "token",
        externalProjectId: 42,
        pathWithNamespace: "acme/widgets",
        type: IssueSuggestionType.DESCRIPTION,
        suggestedText: "### Draft",
        issueIid: 15,
        relatedIssueIid: null,
      },
      {
        primary: { id: "issue-1", gitlabIssueIid: 15 },
        related: null,
      },
    );

    expect(result.localUpdates).toEqual([
      { issueId: "issue-1", description: "### Draft" },
    ]);
  });

  it("writes GitHub duplicate suggestions", async () => {
    server.use(
      githubIssueCommentHandler("acme", "widgets", 9),
      githubIssueCommentHandler("acme", "widgets", 15),
      githubIssuePatchHandler("acme", "widgets", 15),
    );

    const result = await applySuggestionToVcs(
      {
        provider: VcsProvider.GITHUB,
        baseUrl: "https://api.github.com",
        accessToken: "token",
        externalProjectId: null,
        pathWithNamespace: "acme/widgets",
        type: IssueSuggestionType.DUPLICATE,
        suggestedText: "Possible duplicate",
        issueIid: 15,
        relatedIssueIid: 9,
      },
      {
        primary: { id: "issue-a", gitlabIssueIid: 15 },
        related: { id: "issue-b", gitlabIssueIid: 9 },
      },
    );

    expect(result.localUpdates).toEqual([
      { issueId: "issue-a", state: "CLOSED" },
    ]);
  });

  it("writes GitLab duplicate suggestions", async () => {
    server.use(
      gitlabIssueNoteHandler(42, 9),
      gitlabIssueNoteHandler(42, 15),
      gitlabIssueUpdateHandler(42, 15),
    );

    const result = await applySuggestionToVcs(
      {
        provider: VcsProvider.GITLAB,
        baseUrl: "https://gitlab.example.com",
        accessToken: "token",
        externalProjectId: 42,
        pathWithNamespace: "acme/widgets",
        type: IssueSuggestionType.DUPLICATE,
        suggestedText: "Possible duplicate",
        issueIid: 15,
        relatedIssueIid: 9,
      },
      {
        primary: { id: "issue-a", gitlabIssueIid: 15 },
        related: { id: "issue-b", gitlabIssueIid: 9 },
      },
    );

    expect(result.localUpdates).toEqual([
      { issueId: "issue-a", state: "CLOSED" },
    ]);
  });
});
