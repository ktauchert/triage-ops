import { enqueueSyncJob } from "@/lib/queue";
import { errorResponse, jsonResponse } from "@/lib/api";
import {
  getProjectById,
  triggerProjectSync,
} from "@/lib/services/projects";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;

  const project = await getProjectById(projectId);
  if (!project) {
    return errorResponse("Project not found", 404);
  }

  const syncRun = await triggerProjectSync(projectId);
  if (!syncRun) {
    return errorResponse("Project not found", 404);
  }

  await enqueueSyncJob({
    projectId,
    syncRunId: syncRun.id,
  });

  return jsonResponse({ syncRun }, 202);
}
