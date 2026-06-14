import { prisma, VcsProvider } from "./index";

const DEFAULT_GITHUB_API_URL = "https://api.github.com";

async function main() {
  const gitlabBaseUrl =
    process.env.SEED_GITLAB_BASE_URL ?? "https://gitlab.com";
  const gitlabToken =
    process.env.SEED_GITLAB_TOKEN ?? "replace-me-with-real-token";
  const gitlabProjectId = Number.parseInt(
    process.env.SEED_GITLAB_PROJECT_ID ?? "0",
    10,
  );
  const gitlabPath =
    process.env.SEED_GITLAB_PROJECT_PATH ?? "group/sample-project";
  const gitlabName =
    process.env.SEED_GITLAB_PROJECT_NAME ?? "Sample GitLab Project";

  const githubToken =
    process.env.SEED_GITHUB_TOKEN ?? "replace-me-with-real-token";
  const githubRepo = process.env.SEED_GITHUB_REPO ?? "";
  const githubName = process.env.SEED_GITHUB_REPO_NAME ?? "Sample GitHub Repo";

  const gitlabConnection = await prisma.vcsConnection.upsert({
    where: { id: "seed-gitlab-connection" },
    update: {
      name: "Local GitLab",
      provider: VcsProvider.GITLAB,
      baseUrl: gitlabBaseUrl,
      accessToken: gitlabToken,
    },
    create: {
      id: "seed-gitlab-connection",
      name: "Local GitLab",
      provider: VcsProvider.GITLAB,
      baseUrl: gitlabBaseUrl,
      accessToken: gitlabToken,
    },
  });

  const githubConnection = await prisma.vcsConnection.upsert({
    where: { id: "seed-github-connection" },
    update: {
      name: "My GitHub",
      provider: VcsProvider.GITHUB,
      baseUrl: DEFAULT_GITHUB_API_URL,
      accessToken: githubToken,
    },
    create: {
      id: "seed-github-connection",
      name: "My GitHub",
      provider: VcsProvider.GITHUB,
      baseUrl: DEFAULT_GITHUB_API_URL,
      accessToken: githubToken,
    },
  });

  if (gitlabProjectId > 0) {
    await prisma.project.upsert({
      where: {
        connectionId_pathWithNamespace: {
          connectionId: gitlabConnection.id,
          pathWithNamespace: gitlabPath,
        },
      },
      update: {
        name: gitlabName,
        externalProjectId: gitlabProjectId,
      },
      create: {
        connectionId: gitlabConnection.id,
        externalProjectId: gitlabProjectId,
        pathWithNamespace: gitlabPath,
        name: gitlabName,
      },
    });
  }

  if (githubRepo.includes("/")) {
    await prisma.project.upsert({
      where: {
        connectionId_pathWithNamespace: {
          connectionId: githubConnection.id,
          pathWithNamespace: githubRepo,
        },
      },
      update: {
        name: githubName,
      },
      create: {
        connectionId: githubConnection.id,
        pathWithNamespace: githubRepo,
        name: githubName,
      },
    });
  }

  console.log("Seed complete.");
  console.log(
    "Set SEED_GITHUB_REPO=owner/repo and SEED_GITHUB_TOKEN for GitHub, or SEED_GITLAB_PROJECT_ID for GitLab.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
