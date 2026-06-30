import { VcsProvider } from "@gridnull/db";
import type { RemoteProject } from "@gridnull/shared-types";
import { remoteProjectListErrorMessage, VcsApiError } from "./errors";
import { fetchAllGitHubRepos } from "./github-repos";
import { fetchAllGitLabProjects } from "./gitlab-projects";

export type ListRemoteProjectsParams = {
  provider: VcsProvider;
  baseUrl: string;
  accessToken: string;
};

export async function listRemoteProjects(
  params: ListRemoteProjectsParams,
): Promise<RemoteProject[]> {
  try {
    if (params.provider === VcsProvider.GITHUB) {
      const repos = await fetchAllGitHubRepos({
        accessToken: params.accessToken,
        baseUrl: params.baseUrl,
      });

      return repos
        .map((repo) => ({
          externalProjectId: null,
          pathWithNamespace: repo.full_name,
          name: repo.name,
        }))
        .sort((a, b) => a.pathWithNamespace.localeCompare(b.pathWithNamespace));
    }

    const projects = await fetchAllGitLabProjects({
      baseUrl: params.baseUrl,
      accessToken: params.accessToken,
    });

    return projects
      .map((project) => ({
        externalProjectId: project.id,
        pathWithNamespace: project.path_with_namespace,
        name: project.name,
      }))
      .sort((a, b) => a.pathWithNamespace.localeCompare(b.pathWithNamespace));
  } catch (error) {
    if (error instanceof VcsApiError) {
      throw new Error(
        remoteProjectListErrorMessage(error.provider, error.status),
      );
    }

    throw error;
  }
}
