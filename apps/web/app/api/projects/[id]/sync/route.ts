import { enqueueSyncJob } from "@/lib/queue";
import { errorResponse, jsonResponse } from "@/lib/api";
import {
  getProjectById,
  triggerProjectSync,
} from "@/lib/services/projects";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireApiSession(_request);
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "project.sync");
  if (denied) {
    return denied;
  }

  const { id: projectId } = await context.params;

  const project = await getProjectById(session, projectId);
  if (!project) {
    return errorResponse("Project not found", 404);
  }

  const syncRun = await triggerProjectSync(session, projectId);
  if (!syncRun) {
    return errorResponse("Project not found", 404);
  }

  await enqueueSyncJob({
    projectId,
    syncRunId: syncRun.id,
  });

  return jsonResponse({ syncRun }, 202);
}
