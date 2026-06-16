import { prisma } from "@triage-ops/db";
import { connectionWhereClause } from "@/lib/auth/access";
import type { AuthContext } from "@/lib/auth/session";

export async function getConnectionCredentials(
  ctx: AuthContext,
  connectionId: string,
) {
  return prisma.vcsConnection.findFirst({
    where: {
      id: connectionId,
      ...connectionWhereClause(ctx),
    },
    select: {
      id: true,
      provider: true,
      baseUrl: true,
      accessToken: true,
    },
  });
}
