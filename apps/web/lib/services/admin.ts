import { UserRole, prisma } from "@triage-ops/db";
import { normalizeEmail } from "@/lib/auth/allowlist";
import type { AuthContext } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/services/audit";

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
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
