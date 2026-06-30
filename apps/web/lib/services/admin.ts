import { IssueSuggestionStatus, UserRole, prisma } from "@gridnull/db";
import { normalizeEmail, getAllowlistCounts } from "@/lib/auth/allowlist";
import {
  getConfiguredProviders,
  getDataScope,
  isAuthDisabled,
  getAdminEmails,
} from "@/lib/auth/config";
import { isAllowlistConfigured, isSetupComplete } from "@/lib/auth/setup";
import type { AuthContext } from "@/lib/auth/session";
import { logAuditEvent, listAuditEvents } from "@/lib/services/audit";

export type AdminAuthStatus = {
  authDisabled: boolean;
  setupComplete: boolean;
  setupCompletedAt: Date | null;
  configuredProviders: string[];
  dataScope: string;
  registrationMode: "closed" | "open" | "bootstrap";
  allowlistConfigured: boolean;
  allowlistDomainCount: number;
  allowlistEmailCount: number;
  adminEmailsFallbackCount: number;
  activeSessionCount: number;
  deactivatedUserCount: number;
};

export type AdminJobFailure = {
  id: string;
  kind: "sync" | "analysis" | "writeback";
  projectId: string;
  projectName: string;
  status: string;
  errorMessage: string | null;
  occurredAt: Date;
};

export type AdminBackgroundJob = {
  id: string;
  kind: "sync" | "analysis" | "writeback";
  projectId: string;
  projectName: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  detail: string | null;
  appliedByEmail: string | null;
};

export type AdminConnectionSummary = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  projectCount: number;
  ownerEmail: string | null;
  createdAt: Date;
};

export type AdminOverview = {
  totalUsers: number;
  pendingInviteCount: number;
  usersByRole: Record<UserRole, number>;
  recentAuditEvents: Array<{
    id: string;
    action: string;
    createdAt: Date;
    userEmail: string | null;
  }>;
  auth: AdminAuthStatus;
  connections: AdminConnectionSummary[];
  recentJobFailures: AdminJobFailure[];
  recentBackgroundJobs: AdminBackgroundJob[];
};

export function countUsersByRole(
  users: Array<{ role: UserRole }>,
): Record<UserRole, number> {
  const counts: Record<UserRole, number> = {
    ADMIN: 0,
    LEAD: 0,
    OPERATOR: 0,
    VIEWER: 0,
  };

  for (const user of users) {
    counts[user.role] += 1;
  }

  return counts;
}

export function mergeBackgroundJobs(
  jobs: AdminBackgroundJob[],
  limit = 30,
): AdminBackgroundJob[] {
  return [...jobs]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit);
}

export function mergeJobFailures(
  failures: AdminJobFailure[],
  limit = 10,
): AdminJobFailure[] {
  return [...failures]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);
}

export async function getAdminAuthStatus(): Promise<AdminAuthStatus> {
  const [
    settings,
    setupComplete,
    activeSessionCount,
    deactivatedUserCount,
  ] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "default" } }),
    isSetupComplete(),
    prisma.session.count({
      where: { expires: { gt: new Date() } },
    }),
    prisma.user.count({
      where: { deactivatedAt: { not: null } },
    }),
  ]);

  let registrationMode: AdminAuthStatus["registrationMode"] = "bootstrap";
  if (isAuthDisabled()) {
    registrationMode = "open";
  } else if (setupComplete) {
    registrationMode = "closed";
  }

  const allowlistCounts = getAllowlistCounts();

  return {
    authDisabled: isAuthDisabled(),
    setupComplete,
    setupCompletedAt: settings?.setupCompletedAt ?? null,
    configuredProviders: getConfiguredProviders(),
    dataScope: getDataScope(),
    registrationMode,
    allowlistConfigured: isAllowlistConfigured(),
    allowlistDomainCount: allowlistCounts.domainCount,
    allowlistEmailCount: allowlistCounts.emailCount,
    adminEmailsFallbackCount: getAdminEmails().length,
    activeSessionCount,
    deactivatedUserCount,
  };
}

async function listAdminConnectionSummaries(): Promise<AdminConnectionSummary[]> {
  const connections = await prisma.vcsConnection.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      createdAt: true,
      user: {
        select: { email: true },
      },
      _count: {
        select: { projects: true },
      },
    },
  });

  return connections.map((connection) => ({
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    baseUrl: connection.baseUrl,
    projectCount: connection._count.projects,
    ownerEmail: connection.user?.email ?? null,
    createdAt: connection.createdAt,
  }));
}

export async function listRecentBackgroundJobs(
  limit = 30,
): Promise<AdminBackgroundJob[]> {
  const perSource = Math.max(limit, 10);

  const [syncRuns, analysisRuns, writeBackJobs] = await Promise.all([
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: perSource,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        issuesSynced: true,
        errorMessage: true,
        project: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.llmAnalysisRun.findMany({
      orderBy: { startedAt: "desc" },
      take: perSource,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        completedSteps: true,
        totalSteps: true,
        progressLabel: true,
        suggestionsCreated: true,
        errorMessage: true,
        project: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.issueSuggestion.findMany({
      where: {
        status: {
          in: [
            IssueSuggestionStatus.APPLYING,
            IssueSuggestionStatus.APPLIED,
            IssueSuggestionStatus.APPLY_FAILED,
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: perSource,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        updatedAt: true,
        writeBackError: true,
        project: {
          select: { id: true, name: true },
        },
        appliedBy: {
          select: { email: true },
        },
      },
    }),
  ]);

  return mergeBackgroundJobs(
    [
      ...syncRuns.map((run) => ({
        id: run.id,
        kind: "sync" as const,
        projectId: run.project.id,
        projectName: run.project.name,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        errorMessage: run.errorMessage,
        detail:
          run.issuesSynced != null
            ? `${run.issuesSynced} issue${run.issuesSynced === 1 ? "" : "s"} synced`
            : null,
        appliedByEmail: null,
      })),
      ...analysisRuns.map((run) => ({
        id: run.id,
        kind: "analysis" as const,
        projectId: run.project.id,
        projectName: run.project.name,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        errorMessage: run.errorMessage,
        detail: run.progressLabel
          ? run.progressLabel
          : run.totalSteps > 0
            ? `${run.completedSteps}/${run.totalSteps} steps · ${run.suggestionsCreated} suggestions`
            : `${run.suggestionsCreated} suggestions`,
        appliedByEmail: null,
      })),
      ...writeBackJobs.map((suggestion) => ({
        id: suggestion.id,
        kind: "writeback" as const,
        projectId: suggestion.project.id,
        projectName: suggestion.project.name,
        status: suggestion.status,
        startedAt: suggestion.appliedAt ?? suggestion.updatedAt,
        completedAt:
          suggestion.status === IssueSuggestionStatus.APPLYING
            ? null
            : suggestion.appliedAt ?? suggestion.updatedAt,
        errorMessage: suggestion.writeBackError,
        detail: null,
        appliedByEmail: suggestion.appliedBy?.email ?? null,
      })),
    ],
    limit,
  );
}

async function listRecentJobFailures(limit = 10): Promise<AdminJobFailure[]> {
  const [syncFailures, analysisFailures, writeBackFailures] =
    await Promise.all([
      prisma.syncRun.findMany({
        where: { status: "FAILED" },
        orderBy: { startedAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          errorMessage: true,
          startedAt: true,
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.llmAnalysisRun.findMany({
        where: { status: "FAILED" },
        orderBy: { startedAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          errorMessage: true,
          startedAt: true,
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.issueSuggestion.findMany({
        where: { status: IssueSuggestionStatus.APPLY_FAILED },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          writeBackError: true,
          updatedAt: true,
          project: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

  return mergeJobFailures([
    ...syncFailures.map((run) => ({
      id: run.id,
      kind: "sync" as const,
      projectId: run.project.id,
      projectName: run.project.name,
      status: run.status,
      errorMessage: run.errorMessage,
      occurredAt: run.startedAt,
    })),
    ...analysisFailures.map((run) => ({
      id: run.id,
      kind: "analysis" as const,
      projectId: run.project.id,
      projectName: run.project.name,
      status: run.status,
      errorMessage: run.errorMessage,
      occurredAt: run.startedAt,
    })),
    ...writeBackFailures.map((suggestion) => ({
      id: suggestion.id,
      kind: "writeback" as const,
      projectId: suggestion.project.id,
      projectName: suggestion.project.name,
      status: suggestion.status,
      errorMessage: suggestion.writeBackError,
      occurredAt: suggestion.updatedAt,
    })),
  ], limit);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    users,
    pendingInvites,
    recentAudit,
    auth,
    connections,
    recentJobFailures,
    recentBackgroundJobs,
  ] = await Promise.all([
    listUsers(),
    listPendingInvites(),
    listAuditEvents({ limit: 5 }),
    getAdminAuthStatus(),
    listAdminConnectionSummaries(),
    listRecentJobFailures(),
    listRecentBackgroundJobs(5),
  ]);

  return {
    totalUsers: users.length,
    pendingInviteCount: pendingInvites.length,
    usersByRole: countUsersByRole(users),
    recentAuditEvents: recentAudit.map((event) => ({
      id: event.id,
      action: event.action,
      createdAt: event.createdAt,
      userEmail: event.user?.email ?? null,
    })),
    auth,
    connections,
    recentJobFailures,
    recentBackgroundJobs,
  };
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deactivatedAt: true,
    },
  });
}

export async function listPendingInvites() {
  return prisma.provisionedUser.findMany({
    where: { claimedAt: null },
    orderBy: [{ invitedAt: "desc" }],
    select: {
      id: true,
      email: true,
      role: true,
      invitedAt: true,
    },
  });
}

export async function inviteUser(
  ctx: AuthContext,
  email: string,
  role: UserRole,
) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("A valid email address is required");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  const existingInvite = await prisma.provisionedUser.findUnique({
    where: { email: normalized },
    select: { id: true, claimedAt: true },
  });

  if (existingInvite) {
    throw new Error(
      existingInvite.claimedAt
        ? "This email is already registered"
        : "This email is already invited",
    );
  }

  const invite = await prisma.provisionedUser.create({
    data: {
      email: normalized,
      role,
      invitedByUserId: ctx.userId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      invitedAt: true,
    },
  });

  await logAuditEvent({
    userId: ctx.userId,
    action: "user.invite",
    resourceType: "ProvisionedUser",
    resourceId: invite.id,
    metadata: {
      email: normalized,
      role,
    },
  });

  return invite;
}

export async function updateUserRole(
  ctx: AuthContext,
  userId: string,
  role: UserRole,
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });

  if (!existing) {
    return null;
  }

  if (existing.id === ctx.userId && role !== UserRole.ADMIN) {
    throw new Error("Cannot remove your own admin role");
  }

  if (existing.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
    await assertActiveAdminRemains(userId, "demote");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deactivatedAt: true,
    },
  });

  await logAuditEvent({
    userId: ctx.userId,
    action: "user.role.update",
    resourceType: "User",
    resourceId: userId,
    metadata: {
      previousRole: existing.role,
      newRole: role,
      targetEmail: existing.email,
    },
  });

  return updated;
}

async function getUserAdminState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, deactivatedAt: true },
  });
}

async function assertCanModifyTargetUser(
  ctx: AuthContext,
  targetUserId: string,
): Promise<void> {
  if (ctx.userId === targetUserId) {
    throw new Error("Cannot modify your own account");
  }
}

async function assertActiveAdminRemains(
  targetUserId: string,
  change: "deactivate" | "demote" | "delete",
): Promise<void> {
  const target = await getUserAdminState(targetUserId);
  if (!target || target.role !== UserRole.ADMIN || target.deactivatedAt) {
    return;
  }

  const activeAdminCount = await prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      deactivatedAt: null,
    },
  });

  if (activeAdminCount <= 1) {
    throw new Error(`Cannot ${change} the last active admin`);
  }
}

export async function setUserDeactivated(
  ctx: AuthContext,
  userId: string,
  deactivated: boolean,
) {
  await assertCanModifyTargetUser(ctx, userId);

  const existing = await getUserAdminState(userId);
  if (!existing) {
    return null;
  }

  if (deactivated) {
    await assertActiveAdminRemains(userId, "deactivate");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      deactivatedAt: deactivated ? new Date() : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deactivatedAt: true,
    },
  });

  if (deactivated) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  await logAuditEvent({
    userId: ctx.userId,
    action: deactivated ? "user.deactivate" : "user.reactivate",
    resourceType: "User",
    resourceId: userId,
    metadata: {
      targetEmail: existing.email,
    },
  });

  return updated;
}

export async function deleteUser(ctx: AuthContext, userId: string) {
  await assertCanModifyTargetUser(ctx, userId);

  const existing = await getUserAdminState(userId);
  if (!existing) {
    return false;
  }

  await assertActiveAdminRemains(userId, "delete");

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await logAuditEvent({
    userId: ctx.userId,
    action: "user.delete",
    resourceType: "User",
    resourceId: userId,
    metadata: {
      targetEmail: existing.email,
      previousRole: existing.role,
    },
  });

  return true;
}

export async function cancelPendingInvite(
  ctx: AuthContext,
  inviteId: string,
) {
  const invite = await prisma.provisionedUser.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      email: true,
      role: true,
      claimedAt: true,
    },
  });

  if (!invite) {
    return null;
  }

  if (invite.claimedAt) {
    throw new Error("Cannot cancel an invite that was already claimed");
  }

  await prisma.provisionedUser.delete({ where: { id: inviteId } });

  await logAuditEvent({
    userId: ctx.userId,
    action: "user.invite.cancel",
    resourceType: "ProvisionedUser",
    resourceId: inviteId,
    metadata: {
      email: invite.email,
      role: invite.role,
    },
  });

  return invite;
}
