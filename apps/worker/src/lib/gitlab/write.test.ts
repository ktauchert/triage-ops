import { describe, expect, it } from "vitest";
import {
  addGitLabIssueNote,
  closeGitLabIssue,
  updateGitLabIssueDescription,
} from "./write.js";
import {
  gitlabIssueNoteHandler,
  gitlabIssueUpdateHandler,
  server,
} from "../../test/msw-server.js";

const baseParams = {
  baseUrl: "https://gitlab.example.com",
  accessToken: "glpat-test-token",
  gitlabProjectId: 42,
  issueIid: 7,
};

describe("gitlab write", () => {
  it("updates issue description", async () => {
    server.use(gitlabIssueUpdateHandler(42, 7));

    await expect(
      updateGitLabIssueDescription({
        ...baseParams,
        description: "New body",
      }),
    ).resolves.toBeUndefined();
  });

  it("adds issue note and closes issue", async () => {
    server.use(
      gitlabIssueNoteHandler(42, 7),
      gitlabIssueUpdateHandler(42, 7),
    );

    await expect(
      addGitLabIssueNote({ ...baseParams, body: "Duplicate link" }),
    ).resolves.toBeUndefined();
    await expect(closeGitLabIssue(baseParams)).resolves.toBeUndefined();
  });
});
