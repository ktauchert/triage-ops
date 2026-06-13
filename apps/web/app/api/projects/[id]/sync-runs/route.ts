import { errorResponse, jsonResponse } from "@/lib/api";
import {
  getProjectById,
  listSyncRuns,
} from "@/lib/services/projects";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;

  const project = await getProjectById(projectId);
  if (!project) {
    return errorResponse("Project not found", 404);
  }

  const syncRuns = await listSyncRuns(projectId);
  return jsonResponse({ syncRuns });
}
