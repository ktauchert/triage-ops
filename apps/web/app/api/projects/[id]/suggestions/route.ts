import { IssueSuggestionStatus } from "@triage-ops/db";
import { errorResponse, jsonResponse } from "@/lib/api";
import { listSuggestions } from "@/lib/services/suggestions";
import { requireApiSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const { id: projectId } = await context.params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");

  let status: IssueSuggestionStatus | undefined;
  if (statusParam) {
    if (
      statusParam !== IssueSuggestionStatus.PENDING &&
      statusParam !== IssueSuggestionStatus.DISMISSED &&
      statusParam !== IssueSuggestionStatus.APPLIED
    ) {
      return errorResponse(
        "status must be PENDING, DISMISSED, or APPLIED",
        400,
      );
    }
    status = statusParam;
  }

  const suggestions = await listSuggestions(session, projectId, status);
  if (!suggestions) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ suggestions });
}
