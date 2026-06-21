import { UserRole } from "@triage-ops/db";
import {
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateUserRole } from "@/lib/services/admin";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const VALID_ROLES = new Set<string>(Object.values(UserRole));

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const body = await parseJsonBody<{ role?: unknown }>(request);
  if (isErrorResponse(body)) {
    return body;
  }

  if (typeof body.role !== "string" || !VALID_ROLES.has(body.role)) {
    return errorResponse("role must be ADMIN, LEAD, OPERATOR, or VIEWER", 400);
  }

  const { userId } = await context.params;

  try {
    const user = await updateUserRole(session, userId, body.role as UserRole);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    return jsonResponse({ user });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update user role",
      400,
    );
  }
}
