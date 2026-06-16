import {
  deleteProject,
  setProjectFavorite,
} from "@/lib/services/projects";
import {
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await context.params;
  const deleted = await deleteProject(session, id);

  if (!deleted) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await context.params;
  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (isErrorResponse(body)) {
    return body;
  }

  if (typeof body.isFavorite !== "boolean") {
    return errorResponse("isFavorite must be a boolean", 400);
  }

  const project = await setProjectFavorite(session, id, body.isFavorite);
  if (!project) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ project });
}
