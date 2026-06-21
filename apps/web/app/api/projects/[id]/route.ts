import {
  deleteProject,
  updateProjectSettings,
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

function parseOptionalNonNegativeInt(
  value: unknown,
  field: string,
): number | undefined | Response {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return errorResponse(`${field} must be a non-negative integer`, 400);
  }

  return value;
}

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

  const ghostThresholdDays = parseOptionalNonNegativeInt(
    body.ghostThresholdDays,
    "ghostThresholdDays",
  );
  if (ghostThresholdDays instanceof Response) {
    return ghostThresholdDays;
  }

  const zombieThresholdDays = parseOptionalNonNegativeInt(
    body.zombieThresholdDays,
    "zombieThresholdDays",
  );
  if (zombieThresholdDays instanceof Response) {
    return zombieThresholdDays;
  }

  if (
    body.isFavorite !== undefined &&
    typeof body.isFavorite !== "boolean"
  ) {
    return errorResponse("isFavorite must be a boolean", 400);
  }

  if (
    body.isFavorite === undefined &&
    ghostThresholdDays === undefined &&
    zombieThresholdDays === undefined &&
    body.autoSyncEnabled === undefined &&
    body.autoSyncIntervalMinutes === undefined
  ) {
    return errorResponse(
      "Provide isFavorite, ghostThresholdDays, zombieThresholdDays, autoSyncEnabled, and/or autoSyncIntervalMinutes",
      400,
    );
  }

  if (
    body.autoSyncEnabled !== undefined &&
    typeof body.autoSyncEnabled !== "boolean"
  ) {
    return errorResponse("autoSyncEnabled must be a boolean", 400);
  }

  const autoSyncIntervalMinutes = parseOptionalNonNegativeInt(
    body.autoSyncIntervalMinutes,
    "autoSyncIntervalMinutes",
  );
  if (autoSyncIntervalMinutes instanceof Response) {
    return autoSyncIntervalMinutes;
  }

  if (
    autoSyncIntervalMinutes !== undefined &&
    autoSyncIntervalMinutes > 0 &&
    autoSyncIntervalMinutes < 15
  ) {
    return errorResponse("autoSyncIntervalMinutes must be at least 15", 400);
  }

  try {
    const project = await updateProjectSettings(session, id, {
      isFavorite:
        typeof body.isFavorite === "boolean" ? body.isFavorite : undefined,
      ghostThresholdDays,
      zombieThresholdDays,
      autoSyncEnabled:
        typeof body.autoSyncEnabled === "boolean"
          ? body.autoSyncEnabled
          : undefined,
      autoSyncIntervalMinutes,
    });

    if (!project) {
      return errorResponse("Project not found", 404);
    }

    return jsonResponse({ project });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update project",
      400,
    );
  }
}
