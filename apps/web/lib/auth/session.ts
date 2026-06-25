import { UserRole, prisma } from "@triage-ops/db";
import { errorResponse } from "@/lib/api";
import { auth } from "@/auth";
import { enforceApiRateLimit } from "@/lib/rate-limit/enforce";
import { authConfig, type AuthDataScope } from "./config";
import { isDevAuthBypassAllowed } from "./environment";
import { ensureDevUser } from "./dev-user";
import { assertSetupAllowsApiAccess } from "./setup";

export type AuthContext = {
  userId: string;
  role: UserRole;
  dataScope: AuthDataScope;
  email?: string | null;
  name?: string | null;
};

async function loadUser(
  userId: string,
): Promise<{ role: UserRole; deactivatedAt: Date | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, deactivatedAt: true },
  });
}

function buildAuthContext(
  userId: string,
  role: UserRole,
  email?: string | null,
  name?: string | null,
): AuthContext {
  return {
    userId,
    role,
    dataScope: authConfig.dataScope,
    email,
    name,
  };
}

export async function getAuthContext(): Promise<AuthContext> {
  if (authConfig.disabled) {
    if (!isDevAuthBypassAllowed()) {
      throw new Error("Unauthorized");
    }

    const userId = await ensureDevUser();
    return buildAuthContext(userId, UserRole.ADMIN, "dev@local", "Local Dev");
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await loadUser(session.user.id);
  if (!user || user.deactivatedAt) {
    throw new Error("Unauthorized");
  }

  return buildAuthContext(
    session.user.id,
    user.role,
    session.user.email,
    session.user.name,
  );
}

export async function requireApiSession(
  request: Request,
): Promise<AuthContext | Response> {
  const setupBlocked = await assertSetupAllowsApiAccess();
  if (setupBlocked) {
    return setupBlocked;
  }

  let context: AuthContext;

  if (authConfig.disabled) {
    if (!isDevAuthBypassAllowed()) {
      return errorResponse("Unauthorized", 401);
    }

    const userId = await ensureDevUser();
    context = buildAuthContext(userId, UserRole.ADMIN, "dev@local", "Local Dev");
  } else {
    const session = await auth();

    if (!session?.user?.id) {
      return errorResponse("Unauthorized", 401);
    }

    const user = await loadUser(session.user.id);
    if (!user || user.deactivatedAt) {
      return errorResponse("Unauthorized", 401);
    }

    context = buildAuthContext(
      session.user.id,
      user.role,
      session.user.email,
      session.user.name,
    );
  }

  const rateLimited = await enforceApiRateLimit(request, context.userId);
  if (rateLimited) {
    return rateLimited;
  }

  return context;
}

export async function getSessionUser(): Promise<{
  email?: string | null;
  name?: string | null;
} | null> {
  if (authConfig.disabled) {
    if (!isDevAuthBypassAllowed()) {
      return null;
    }

    return { email: "dev@local", name: "Local Dev" };
  }

  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return {
    email: session.user.email,
    name: session.user.name,
  };
}
