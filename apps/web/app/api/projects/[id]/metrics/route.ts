import { errorResponse, jsonResponse } from "@/lib/api";
import { getProjectMetrics } from "@/lib/services/metrics";

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
  const { id: projectId } = await context.params;
  const { searchParams } = new URL(request.url);

  const ghostDays = parseOptionalInt(searchParams.get("ghostDays"));
  const zombieDays = parseOptionalInt(searchParams.get("zombieDays"));

  const metrics = await getProjectMetrics(projectId, { ghostDays, zombieDays });

  if (!metrics) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ metrics });
}
