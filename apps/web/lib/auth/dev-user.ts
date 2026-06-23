import { UserRole, prisma } from "@triage-ops/db";
import { DEV_USER_ID } from "./config";
import { isDevAuthBypassAllowed } from "./environment";

export async function ensureDevUser(): Promise<string> {
  if (!isDevAuthBypassAllowed()) {
    throw new Error("Development auth bypass is not enabled");
  }

  const user = await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: { role: UserRole.ADMIN },
    create: {
      id: DEV_USER_ID,
      email: "dev@local",
      name: "Local Dev",
      role: UserRole.ADMIN,
    },
  });

  return user.id;
}
