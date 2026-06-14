import { errorResponse } from "@/lib/api";
import { auth } from "@/auth";
import { authConfig, type AuthDataScope } from "./config";
import { ensureDevUser } from "./dev-user";

export type AuthContext = {
  userId: string;
  dataScope: AuthDataScope;
  email?: string | null;
  name?: string | null;
};

async function buildAuthContext(
  userId: string,
  email?: string | null,
  name?: string | null,
): Promise<AuthContext> {
  return {
    userId,
    dataScope: authConfig.dataScope,
    email,
    name,
  };
}

export async function getAuthContext(): Promise<AuthContext> {
  if (authConfig.disabled) {
    const userId = await ensureDevUser();
    return buildAuthContext(userId, "dev@local", "Local Dev");
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return buildAuthContext(
    session.user.id,
    session.user.email,
    session.user.name,
  );
}

export async function requireApiSession(): Promise<AuthContext | Response> {
  if (authConfig.disabled) {
    const userId = await ensureDevUser();
    return buildAuthContext(userId, "dev@local", "Local Dev");
  }

  const session = await auth();

  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  return buildAuthContext(
    session.user.id,
    session.user.email,
    session.user.name,
  );
}

export async function getSessionUser(): Promise<{
  email?: string | null;
  name?: string | null;
} | null> {
  if (authConfig.disabled) {
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
