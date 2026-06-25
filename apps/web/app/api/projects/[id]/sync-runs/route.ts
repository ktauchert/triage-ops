import { errorResponse, jsonResponse } from "@/lib/api";
import {
  getProjectById,
  listSyncRuns,
} from "@/lib/services/projects";
import { requireApiSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession(_request);
  if (session instanceof Response) {
    return session;
  }

  const { id: projectId } = await context.params;

  const project = await getProjectById(session, projectId);
  if (!project) {
    return errorResponse("Project not found", 404);
  }

  const syncRuns = await listSyncRuns(session, projectId);
  if (!syncRuns) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ syncRuns });
}
