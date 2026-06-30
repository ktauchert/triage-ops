import { UserRole } from "@gridnull/db";
import {
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import {
  cancelPendingInvite,
  deleteUser,
  setUserDeactivated,
  updateUserRole,
} from "@/lib/services/admin";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const VALID_ROLES = new Set<string>(Object.values(UserRole));

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession(request);
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const body = await parseJsonBody<{ role?: unknown; deactivated?: unknown }>(
    request,
  );
  if (isErrorResponse(body)) {
    return body;
  }

  const hasRole = body.role !== undefined;
  const hasDeactivated = body.deactivated !== undefined;

  if (!hasRole && !hasDeactivated) {
    return errorResponse("role or deactivated is required", 400);
  }

  if (hasRole && (typeof body.role !== "string" || !VALID_ROLES.has(body.role))) {
    return errorResponse("role must be ADMIN, LEAD, OPERATOR, or VIEWER", 400);
  }

  if (
    hasDeactivated &&
    typeof body.deactivated !== "boolean"
  ) {
    return errorResponse("deactivated must be a boolean", 400);
  }

  const { userId } = await context.params;

  try {
    let user = null;

    if (hasRole) {
      user = await updateUserRole(session, userId, body.role as UserRole);
      if (!user) {
        return errorResponse("User not found", 404);
      }
    }

    if (hasDeactivated) {
      user = await setUserDeactivated(
        session,
        userId,
        body.deactivated as boolean,
      );
      if (!user) {
        return errorResponse("User not found", 404);
      }
    }

    return jsonResponse({ user });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update user",
      400,
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession(_request);
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const { userId } = await context.params;

  try {
    const deleted = await deleteUser(session, userId);
    if (!deleted) {
      return errorResponse("User not found", 404);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete user",
      400,
    );
  }
}
