import { openAccessToken, prisma } from "@gridnull/db";
import { connectionWhereClause } from "@/lib/auth/access";
import type { AuthContext } from "@/lib/auth/session";

export async function getConnectionCredentials(
  ctx: AuthContext,
  connectionId: string,
) {
  const connection = await prisma.vcsConnection.findFirst({
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

  if (!connection) {
    return null;
  }

  return {
    ...connection,
    accessToken: openAccessToken(connection.accessToken),
  };
}
