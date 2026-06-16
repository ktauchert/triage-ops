import { VcsProvider } from "@triage-ops/db";

export class VcsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: VcsProvider,
  ) {
    super(message);
    this.name = "VcsApiError";
  }
}

export function remoteProjectListErrorMessage(
  provider: VcsProvider,
  status: number,
): string {
  if (status === 401) {
    return "The access token was rejected. Update the connection with a valid token.";
  }

  if (status === 403) {
    if (provider === VcsProvider.GITHUB) {
      return "This token cannot list repositories. Use a GitHub PAT with the repo scope (or public_repo for public repos only).";
    }

    return "This token cannot list projects. Use a GitLab PAT with the read_api scope.";
  }

  return `Failed to list ${provider === VcsProvider.GITHUB ? "repositories" : "projects"} from the provider (HTTP ${status}).`;
}
