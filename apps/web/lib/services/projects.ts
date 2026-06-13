import { prisma, VcsProvider } from "@triage-ops/db";
import { DEFAULT_GITHUB_API_URL } from "@triage-ops/shared-types";

export type CreateConnectionInput = {
  name: string;
  provider: VcsProvider;
  baseUrl?: string;
  accessToken: string;
};

export async function listConnections() {
  return prisma.vcsConnection.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: true } },
    },
  });
}

export async function createConnection(input: CreateConnectionInput) {
  const baseUrl =
    input.provider === VcsProvider.GITHUB
      ? (input.baseUrl?.trim() || DEFAULT_GITHUB_API_URL)
      : (input.baseUrl?.trim() ?? "");

  return prisma.vcsConnection.create({
    data: {
      name: input.name,
      provider: input.provider,
      baseUrl,
      accessToken: input.accessToken,
    },
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type CreateProjectInput = {
  connectionId: string;
  externalProjectId?: number;
  pathWithNamespace: string;
  name: string;
};

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      connection: {
        select: { id: true, name: true, baseUrl: true, provider: true },
      },
      syncRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function createProject(input: CreateProjectInput) {
  const connection = await prisma.vcsConnection.findUnique({
    where: { id: input.connectionId },
    select: { id: true, provider: true },
  });

  if (!connection) {
    return null;
  }

  if (
    connection.provider === VcsProvider.GITLAB &&
    (input.externalProjectId === undefined ||
      !Number.isInteger(input.externalProjectId) ||
      input.externalProjectId <= 0)
  ) {
    throw new Error("GitLab projects require a positive externalProjectId");
  }

  return prisma.project.create({
    data: {
      connectionId: input.connectionId,
      externalProjectId:
        connection.provider === VcsProvider.GITLAB
          ? input.externalProjectId
          : null,
      pathWithNamespace: input.pathWithNamespace,
      name: input.name,
    },
    include: {
      connection: {
        select: { id: true, name: true, baseUrl: true, provider: true },
      },
    },
  });
}

export async function getProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      connection: {
        select: { id: true, name: true, baseUrl: true, provider: true },
      },
    },
  });
}

export async function listSyncRuns(projectId: string) {
  return prisma.syncRun.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
}

export async function triggerProjectSync(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return null;
  }

  return prisma.syncRun.create({
    data: {
      projectId,
      status: "PENDING",
    },
  });
}
