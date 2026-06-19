import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { updateSuggestionStatus } from "@/lib/services/suggestions";
import { requireApiSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string; suggestionId: string }>;
};

type PatchBody = {
  status?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const body = await parseJsonBody<PatchBody>(request);
  if (body instanceof Response) {
    return body;
  }

  const status = body.status;
  if (status !== "DISMISSED" && status !== "APPLIED") {
    return errorResponse('status must be "DISMISSED" or "APPLIED"', 400);
  }

  const { id: projectId, suggestionId } = await context.params;

  try {
    const suggestion = await updateSuggestionStatus(
      session,
      projectId,
      suggestionId,
      { status },
    );

    if (suggestion === null) {
      return errorResponse("Project not found", 404);
    }

    if (suggestion === undefined) {
      return errorResponse("Suggestion not found", 404);
    }

    return jsonResponse({ suggestion });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }
    return errorResponse("Failed to update suggestion", 500);
  }
}
