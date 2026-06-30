import { errorResponse, jsonResponse } from "@/lib/api";
import { getProjectMetrics } from "@/lib/services/metrics";
import { getProjectById } from "@/lib/services/projects";
import { requireApiSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseOptionalInt(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await requireApiSession(request);
  if (session instanceof Response) {
    return session;
  }

  const { id: projectId } = await context.params;
  const { searchParams } = new URL(request.url);

  const project = await getProjectById(session, projectId);
  if (!project) {
    return errorResponse("Project not found", 404);
  }

  const staleDays = parseOptionalInt(searchParams.get("staleDays"));
  const stuckDays = parseOptionalInt(searchParams.get("stuckDays"));

  const metrics = await getProjectMetrics(projectId, { staleDays, stuckDays });

  if (!metrics) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ metrics });
}
