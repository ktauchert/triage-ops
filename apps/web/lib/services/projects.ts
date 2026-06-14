import { prisma, VcsProvider } from "@triage-ops/db";
import { DEFAULT_GITHUB_API_URL } from "@triage-ops/shared-types";
import {
  canAccessConnection,
  connectionWhereClause,
  projectWhereClause,
} from "@/lib/auth/access";
import type { AuthContext } from "@/lib/auth/session";

export type CreateConnectionInput = {
  name: string;
  provider: VcsProvider;
  baseUrl?: string;
  accessToken: string;
};

export async function listConnections(ctx: AuthContext) {
  return prisma.vcsConnection.findMany({
    where: connectionWhereClause(ctx),
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

export async function createConnection(
  ctx: AuthContext,
  input: CreateConnectionInput,
) {
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
      userId: ctx.userId,
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

export async function listProjects(ctx: AuthContext) {
  return prisma.project.findMany({
    where: projectWhereClause(ctx),
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

export async function createProject(
  ctx: AuthContext,
  input: CreateProjectInput,
) {
  const connection = await prisma.vcsConnection.findUnique({
    where: { id: input.connectionId },
    select: { id: true, provider: true, userId: true },
  });

  if (!connection || !canAccessConnection(ctx, connection.userId)) {
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

export async function getProjectById(ctx: AuthContext, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      connection: {
        select: {
          id: true,
          name: true,
          baseUrl: true,
          provider: true,
          userId: true,
        },
      },
    },
  });

  if (!project || !canAccessConnection(ctx, project.connection.userId)) {
    return null;
  }

  return project;
}

export async function listSyncRuns(ctx: AuthContext, projectId: string) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  return prisma.syncRun.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
}

export async function triggerProjectSync(ctx: AuthContext, projectId: string) {
  const project = await getProjectById(ctx, projectId);
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
