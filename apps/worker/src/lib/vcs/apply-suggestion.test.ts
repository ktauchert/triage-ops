import { IssueSuggestionType, VcsProvider } from "@triage-ops/db";
import { describe, expect, it } from "vitest";
import { applySuggestionToVcs } from "./apply-suggestion.js";
import {
  githubIssueCommentErrorHandler,
  githubIssueCommentHandler,
  githubIssuePatchErrorHandler,
  githubIssuePatchHandler,
  gitlabIssueNoteHandler,
  gitlabIssueUpdateHandler,
  gitlabIssueWriteErrorHandler,
  server,
} from "../../test/msw-server.js";

const gitlabDescriptionContext = {
  provider: VcsProvider.GITLAB,
  baseUrl: "https://gitlab.example.com",
  accessToken: "token",
  externalProjectId: 42,
  pathWithNamespace: "acme/widgets",
  type: IssueSuggestionType.DESCRIPTION,
  suggestedText: "### Draft",
  issueIid: 15,
  relatedIssueIid: null,
};

const githubDescriptionContext = {
  provider: VcsProvider.GITHUB,
  baseUrl: "https://api.github.com",
  accessToken: "token",
  externalProjectId: null,
  pathWithNamespace: "acme/widgets",
  type: IssueSuggestionType.DESCRIPTION,
  suggestedText: "### Draft",
  issueIid: 15,
  relatedIssueIid: null,
};

describe("applySuggestionToVcs", () => {
  it("writes GitLab description suggestions", async () => {
    server.use(gitlabIssueUpdateHandler(42, 15));

    const result = await applySuggestionToVcs(gitlabDescriptionContext, {
      primary: { id: "issue-1", gitlabIssueIid: 15 },
      related: null,
    });

    expect(result.localUpdates).toEqual([
      { issueId: "issue-1", description: "### Draft" },
    ]);
  });

  it("throws when GitLab description write fails", async () => {
    server.use(...gitlabIssueWriteErrorHandler(42, 15, 403, "Forbidden"));

    await expect(
      applySuggestionToVcs(gitlabDescriptionContext, {
        primary: { id: "issue-1", gitlabIssueIid: 15 },
        related: null,
      }),
    ).rejects.toThrow(/403/);
  });

  it("throws when GitLab project has no externalProjectId", async () => {
    await expect(
      applySuggestionToVcs(
        { ...gitlabDescriptionContext, externalProjectId: null },
        {
          primary: { id: "issue-1", gitlabIssueIid: 15 },
          related: null,
        },
      ),
    ).rejects.toThrow(/externalProjectId/);
  });

  it("throws when GitHub description write fails", async () => {
    server.use(githubIssuePatchErrorHandler("acme", "widgets", 15, 403, "Forbidden"));

    await expect(
      applySuggestionToVcs(githubDescriptionContext, {
        primary: { id: "issue-1", gitlabIssueIid: 15 },
        related: null,
      }),
    ).rejects.toThrow(/403/);
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

  it("throws when GitHub duplicate comment write fails", async () => {
    server.use(
      githubIssueCommentErrorHandler("acme", "widgets", 15, 502, "Bad Gateway"),
    );

    await expect(
      applySuggestionToVcs(
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
      ),
    ).rejects.toThrow(/502/);
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
