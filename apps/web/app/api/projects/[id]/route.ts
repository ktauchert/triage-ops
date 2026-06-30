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
import { requirePermission } from "@/lib/auth/permissions";

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
  const session = await requireApiSession(_request);
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "projects.manage");
  if (denied) {
    return denied;
  }

  const { id } = await context.params;
  const deleted = await deleteProject(session, id);

  if (!deleted) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession(request);
  if (session instanceof Response) {
    return session;
  }

  const { id } = await context.params;
  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (isErrorResponse(body)) {
    return body;
  }

  const staleThresholdDays = parseOptionalNonNegativeInt(
    body.staleThresholdDays,
    "staleThresholdDays",
  );
  if (staleThresholdDays instanceof Response) {
    return staleThresholdDays;
  }

  const stuckThresholdDays = parseOptionalNonNegativeInt(
    body.stuckThresholdDays,
    "stuckThresholdDays",
  );
  if (stuckThresholdDays instanceof Response) {
    return stuckThresholdDays;
  }

  if (
    body.isFavorite !== undefined &&
    typeof body.isFavorite !== "boolean"
  ) {
    return errorResponse("isFavorite must be a boolean", 400);
  }

  if (
    body.isFavorite === undefined &&
    staleThresholdDays === undefined &&
    stuckThresholdDays === undefined &&
    body.autoSyncEnabled === undefined &&
    body.autoSyncIntervalMinutes === undefined
  ) {
    return errorResponse(
      "Provide isFavorite, staleThresholdDays, stuckThresholdDays, autoSyncEnabled, and/or autoSyncIntervalMinutes",
      400,
    );
  }

  const settingsRequested =
    staleThresholdDays !== undefined ||
    stuckThresholdDays !== undefined ||
    body.autoSyncEnabled !== undefined ||
    body.autoSyncIntervalMinutes !== undefined;

  if (settingsRequested) {
    const denied = requirePermission(session, "project.settings");
    if (denied) {
      return denied;
    }
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
      staleThresholdDays,
      stuckThresholdDays,
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
