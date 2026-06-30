import { prisma, VcsProvider, sealAccessToken } from "@gridnull/db";
import { DEFAULT_GITHUB_API_URL } from "@gridnull/shared-types";
import {
  canAccessConnection,
  connectionWhereClause,
  projectWhereClause,
} from "@/lib/auth/access";
import type { AuthContext } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/services/audit";

export type CreateConnectionInput = {
  name: string;
  provider: VcsProvider;
  baseUrl?: string;
  accessToken: string;
};

const favoriteFirst = [
  { isFavorite: "desc" as const },
  { createdAt: "desc" as const },
];

export async function listConnections(ctx: AuthContext) {
  return prisma.vcsConnection.findMany({
    where: connectionWhereClause(ctx),
    orderBy: favoriteFirst,
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      isFavorite: true,
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

  const connection = await prisma.vcsConnection.create({
    data: {
      name: input.name,
      provider: input.provider,
      baseUrl,
      accessToken: sealAccessToken(input.accessToken),
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

  await logAuditEvent({
    userId: ctx.userId,
    action: "connection.create",
    resourceType: "VcsConnection",
    resourceId: connection.id,
    metadata: {
      name: connection.name,
      provider: connection.provider,
    },
  });

  return connection;
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
    orderBy: favoriteFirst,
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

  const project = await prisma.project.create({
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

  await logAuditEvent({
    userId: ctx.userId,
    action: "project.create",
    resourceType: "Project",
    resourceId: project.id,
    metadata: {
      name: project.name,
      pathWithNamespace: project.pathWithNamespace,
    },
  });

  return project;
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

  const syncRun = await prisma.syncRun.create({
    data: {
      projectId,
      status: "PENDING",
    },
  });

  await logAuditEvent({
    userId: ctx.userId,
    action: "project.sync",
    resourceType: "Project",
    resourceId: projectId,
    metadata: { syncRunId: syncRun.id },
  });

  return syncRun;
}

export async function deleteConnection(ctx: AuthContext, connectionId: string) {
  const connection = await prisma.vcsConnection.findFirst({
    where: {
      id: connectionId,
      ...connectionWhereClause(ctx),
    },
    select: { id: true, name: true, provider: true },
  });

  if (!connection) {
    return false;
  }

  await prisma.vcsConnection.delete({ where: { id: connectionId } });

  await logAuditEvent({
    userId: ctx.userId,
    action: "connection.delete",
    resourceType: "VcsConnection",
    resourceId: connectionId,
    metadata: {
      name: connection.name,
      provider: connection.provider,
    },
  });

  return true;
}

export async function setConnectionFavorite(
  ctx: AuthContext,
  connectionId: string,
  isFavorite: boolean,
) {
  const connection = await prisma.vcsConnection.findFirst({
    where: {
      id: connectionId,
      ...connectionWhereClause(ctx),
    },
    select: { id: true, name: true },
  });

  if (!connection) {
    return null;
  }

  const updated = await prisma.vcsConnection.update({
    where: { id: connectionId },
    data: { isFavorite },
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: true } },
    },
  });

  await logAuditEvent({
    userId: ctx.userId,
    action: "connection.favorite.update",
    resourceType: "VcsConnection",
    resourceId: connectionId,
    metadata: {
      name: connection.name,
      isFavorite,
    },
  });

  return updated;
}

export async function deleteProject(ctx: AuthContext, projectId: string) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return false;
  }

  await prisma.project.delete({ where: { id: projectId } });

  await logAuditEvent({
    userId: ctx.userId,
    action: "project.delete",
    resourceType: "Project",
    resourceId: projectId,
    metadata: {
      name: project.name,
      pathWithNamespace: project.pathWithNamespace,
    },
  });

  return true;
}

const projectInclude = {
  connection: {
    select: { id: true, name: true, baseUrl: true, provider: true },
  },
  syncRuns: {
    orderBy: { startedAt: "desc" as const },
    take: 1,
  },
};

export async function setProjectFavorite(
  ctx: AuthContext,
  projectId: string,
  isFavorite: boolean,
) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  return prisma.project.update({
    where: { id: projectId },
    data: { isFavorite },
    include: projectInclude,
  });
}

export type UpdateProjectSettingsInput = {
  isFavorite?: boolean;
  staleThresholdDays?: number;
  stuckThresholdDays?: number;
  autoSyncEnabled?: boolean;
  autoSyncIntervalMinutes?: number;
};

function parseNonNegativeInt(value: unknown, field: string): number | Error {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

export async function updateProjectSettings(
  ctx: AuthContext,
  projectId: string,
  input: UpdateProjectSettingsInput,
) {
  const project = await getProjectById(ctx, projectId);
  if (!project) {
    return null;
  }

  const data: {
    isFavorite?: boolean;
    staleThresholdDays?: number;
    stuckThresholdDays?: number;
    autoSyncEnabled?: boolean;
    autoSyncIntervalMinutes?: number;
  } = {};

  if (input.isFavorite !== undefined) {
    data.isFavorite = input.isFavorite;
  }

  if (input.staleThresholdDays !== undefined) {
    const parsed = parseNonNegativeInt(
      input.staleThresholdDays,
      "staleThresholdDays",
    );
    if (parsed instanceof Error) {
      throw parsed;
    }
    data.staleThresholdDays = parsed;
  }

  if (input.stuckThresholdDays !== undefined) {
    const parsed = parseNonNegativeInt(
      input.stuckThresholdDays,
      "stuckThresholdDays",
    );
    if (parsed instanceof Error) {
      throw parsed;
    }
    data.stuckThresholdDays = parsed;
  }

  if (input.autoSyncEnabled !== undefined) {
    data.autoSyncEnabled = input.autoSyncEnabled;
  }

  if (input.autoSyncIntervalMinutes !== undefined) {
    const parsed = parseNonNegativeInt(
      input.autoSyncIntervalMinutes,
      "autoSyncIntervalMinutes",
    );
    if (parsed instanceof Error) {
      throw parsed;
    }
    if (parsed > 0 && parsed < 15) {
      throw new Error("autoSyncIntervalMinutes must be at least 15");
    }
    data.autoSyncIntervalMinutes = parsed;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields to update");
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
    include: projectInclude,
  });

  const settingsChanged =
    input.staleThresholdDays !== undefined ||
    input.stuckThresholdDays !== undefined ||
    input.autoSyncEnabled !== undefined ||
    input.autoSyncIntervalMinutes !== undefined;

  if (settingsChanged) {
    await logAuditEvent({
      userId: ctx.userId,
      action: "project.settings.update",
      resourceType: "Project",
      resourceId: projectId,
      metadata: {
        staleThresholdDays: updated.staleThresholdDays,
        stuckThresholdDays: updated.stuckThresholdDays,
        autoSyncEnabled: updated.autoSyncEnabled,
        autoSyncIntervalMinutes: updated.autoSyncIntervalMinutes,
      },
    });
  }

  return updated;
}

export function pickFavoriteProjectId<T extends { id: string; isFavorite: boolean }>(
  projects: T[],
  preferredId?: string | null,
): string | null {
  if (
    preferredId &&
    projects.some((project) => project.id === preferredId)
  ) {
    return preferredId;
  }

  return projects.find((project) => project.isFavorite)?.id ?? projects[0]?.id ?? null;
}

export function pickFavoriteConnectionId<T extends { id: string; isFavorite: boolean }>(
  connections: T[],
): string {
  return connections.find((connection) => connection.isFavorite)?.id ?? connections[0]?.id ?? "";
}
