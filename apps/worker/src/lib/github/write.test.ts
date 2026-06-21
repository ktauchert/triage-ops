import { describe, expect, it } from "vitest";
import {
  addGitHubIssueComment,
  closeGitHubIssueAsDuplicate,
  updateGitHubIssueBody,
} from "./write.js";
import {
  githubIssueCommentHandler,
  githubIssuePatchHandler,
  server,
} from "../../test/msw-server.js";

const baseParams = {
  accessToken: "ghp-test-token",
  owner: "acme",
  repo: "widgets",
  issueNumber: 7,
};

describe("github write", () => {
  it("updates issue body", async () => {
    server.use(githubIssuePatchHandler("acme", "widgets", 7));

    await expect(
      updateGitHubIssueBody({
        ...baseParams,
        body: "New body",
      }),
    ).resolves.toBeUndefined();
  });

  it("adds comment and closes as duplicate", async () => {
    server.use(
      githubIssueCommentHandler("acme", "widgets", 7),
      githubIssuePatchHandler("acme", "widgets", 7),
    );

    await expect(
      addGitHubIssueComment({ ...baseParams, body: "Duplicate link" }),
    ).resolves.toBeUndefined();
    await expect(closeGitHubIssueAsDuplicate(baseParams)).resolves.toBeUndefined();
  });
});
