import { UserRole } from "@triage-ops/db";
import {
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { inviteUser, listPendingInvites, listUsers } from "@/lib/services/admin";

const VALID_ROLES = new Set<string>(Object.values(UserRole));

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const [users, pendingInvites] = await Promise.all([
    listUsers(),
    listPendingInvites(),
  ]);

  return jsonResponse({ users, pendingInvites });
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const body = await parseJsonBody<{ email?: unknown; role?: unknown }>(request);
  if (isErrorResponse(body)) {
    return body;
  }

  if (typeof body.email !== "string" || !body.email.trim()) {
    return errorResponse("email is required", 400);
  }

  if (typeof body.role !== "string" || !VALID_ROLES.has(body.role)) {
    return errorResponse("role must be ADMIN, LEAD, OPERATOR, or VIEWER", 400);
  }

  try {
    const invite = await inviteUser(
      session,
      body.email,
      body.role as UserRole,
    );
    return jsonResponse({ invite }, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to invite user",
      400,
    );
  }
}
