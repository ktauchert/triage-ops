import type { Prisma } from "@prisma/client";
import type { AuthContext } from "./session";

export function connectionWhereClause(
  ctx: AuthContext,
): Prisma.VcsConnectionWhereInput {
  if (ctx.dataScope === "shared") {
    return {};
  }

  return { userId: ctx.userId };
}

export function projectWhereClause(
  ctx: AuthContext,
): Prisma.ProjectWhereInput {
  if (ctx.dataScope === "shared") {
    return {};
  }

  return {
    connection: {
      userId: ctx.userId,
    },
  };
}

export function canAccessConnection(
  ctx: AuthContext,
  connectionUserId: string | null,
): boolean {
  if (ctx.dataScope === "shared") {
    return true;
  }

  return connectionUserId === ctx.userId;
}
