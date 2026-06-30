import { describe, expect, it } from "vitest";
import { VcsProvider } from "@gridnull/db";
import { remoteProjectListErrorMessage } from "./errors";

describe("remoteProjectListErrorMessage", () => {
  it("mentions GitHub repo scope on 403", () => {
    expect(remoteProjectListErrorMessage(VcsProvider.GITHUB, 403)).toMatch(
      /repo scope/i,
    );
  });

  it("mentions GitLab read_api on 403", () => {
    expect(remoteProjectListErrorMessage(VcsProvider.GITLAB, 403)).toMatch(
      /read_api/i,
    );
  });
});
