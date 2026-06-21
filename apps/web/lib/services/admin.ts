import { UserRole, prisma } from "@triage-ops/db";
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
