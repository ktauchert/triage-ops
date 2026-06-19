import { enqueueLlmAnalysisJob } from "@/lib/queue";
import { errorResponse, jsonResponse } from "@/lib/api";
import { triggerLlmAnalysis } from "@/lib/services/suggestions";
import { requireApiSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const { id: projectId } = await context.params;
  const result = await triggerLlmAnalysis(session, projectId);

  if (!result) {
    return errorResponse("Project not found", 404);
  }

  if (result.alreadyRunning) {
    return jsonResponse(
      { analysisRun: result.analysisRun, message: "Analysis already in progress" },
      409,
    );
  }

  await enqueueLlmAnalysisJob({
    projectId,
    analysisRunId: result.analysisRun.id,
  });

  return jsonResponse({ analysisRun: result.analysisRun }, 202);
}
