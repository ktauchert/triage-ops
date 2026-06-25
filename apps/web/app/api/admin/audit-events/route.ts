import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listAuditEvents } from "@/lib/services/audit";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.audit");
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? undefined;
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const limitParam = url.searchParams.get("limit");

  let from: Date | undefined;
  let to: Date | undefined;

  if (fromParam) {
    from = new Date(fromParam);
    if (Number.isNaN(from.getTime())) {
      return errorResponse("from must be a valid ISO date", 400);
    }
  }

  if (toParam) {
    to = new Date(toParam);
    if (Number.isNaN(to.getTime())) {
      return errorResponse("to must be a valid ISO date", 400);
    }
  }

  let limit: number | undefined;
  if (limitParam) {
    limit = Number.parseInt(limitParam, 10);
    if (Number.isNaN(limit) || limit < 1) {
      return errorResponse("limit must be a positive integer", 400);
    }
  }

  const events = await listAuditEvents({ action, from, to, limit });

  return jsonResponse({
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
      user: event.user
        ? {
            id: event.user.id,
            email: event.user.email,
            name: event.user.name,
          }
        : null,
    })),
  });
}
