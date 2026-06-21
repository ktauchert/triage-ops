import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getConnectionCredentials } from "@/lib/services/connections";
import { listRemoteProjects } from "@/lib/vcs/list-remote-projects";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "projects.manage");
  if (denied) {
    return denied;
  }

  const { id: connectionId } = await context.params;

  const connection = await getConnectionCredentials(session, connectionId);
  if (!connection) {
    return errorResponse("Connection not found", 404);
  }

  try {
    const projects = await listRemoteProjects({
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      accessToken: connection.accessToken,
    });

    return jsonResponse({ projects });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to list remote projects",
      502,
    );
  }
}
