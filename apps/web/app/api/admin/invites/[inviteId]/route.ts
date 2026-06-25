import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { cancelPendingInvite } from "@/lib/services/admin";

type RouteContext = {
  params: Promise<{ inviteId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession(_request);
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const { inviteId } = await context.params;

  try {
    const invite = await cancelPendingInvite(session, inviteId);
    if (!invite) {
      return errorResponse("Invite not found", 404);
    }

    return jsonResponse({ ok: true, invite });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to cancel invite",
      400,
    );
  }
}
