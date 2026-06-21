import { enqueueLlmAnalysisJob } from "@/lib/queue";
import { errorResponse, jsonResponse } from "@/lib/api";
import {
  clearProjectAnalysis,
  getAnalysisPanelData,
  triggerLlmAnalysis,
} from "@/lib/services/suggestions";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import type { LlmAnalysisRun } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function serializeAnalysisRun(run: LlmAnalysisRun) {
  return {
    id: run.id,
    projectId: run.projectId,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    suggestionsCreated: run.suggestionsCreated,
    totalSteps: run.totalSteps,
    completedSteps: run.completedSteps,
    progressLabel: run.progressLabel,
    errorMessage: run.errorMessage,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiSession();
    if (session instanceof Response) {
      return session;
    }

    const denied = requirePermission(session, "suggestions.read");
    if (denied) {
      return denied;
    }

    const { id: projectId } = await context.params;
    const data = await getAnalysisPanelData(session, projectId);

    if (!data) {
      return errorResponse("Project not found", 404);
    }

    return jsonResponse({
      analysisRun: data.analysisRun
        ? serializeAnalysisRun(data.analysisRun)
        : null,
      pendingCount: data.pendingCount,
      suggestions: data.suggestions,
    });
  } catch (error) {
    console.error("[analyze] GET failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to load analysis status",
      503,
    );
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiSession();
    if (session instanceof Response) {
      return session;
    }

    const denied = requirePermission(session, "project.analyze");
    if (denied) {
      return denied;
    }

    const { id: projectId } = await context.params;
    const result = await triggerLlmAnalysis(session, projectId);

    if (!result) {
      return errorResponse("Project not found", 404);
    }

    if (result.alreadyRunning) {
      return jsonResponse(
        {
          analysisRun: serializeAnalysisRun(result.analysisRun),
          message: "Analysis already in progress",
        },
        409,
      );
    }

    await enqueueLlmAnalysisJob({
      projectId,
      analysisRunId: result.analysisRun.id,
    });

    return jsonResponse(
      { analysisRun: serializeAnalysisRun(result.analysisRun) },
      202,
    );
  } catch (error) {
    console.error("[analyze] POST failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to start analysis",
      503,
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiSession();
    if (session instanceof Response) {
      return session;
    }

    const denied = requirePermission(session, "project.analyze");
    if (denied) {
      return denied;
    }

    const { id: projectId } = await context.params;
    const result = await clearProjectAnalysis(session, projectId);

    if (!result) {
      return errorResponse("Project not found", 404);
    }

    if (!result.cleared) {
      return errorResponse(result.reason, 409);
    }

    return jsonResponse({
      cleared: true,
      suggestionsDeleted: result.suggestionsDeleted,
      runsDeleted: result.runsDeleted,
    });
  } catch (error) {
    console.error("[analyze] DELETE failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to clear analysis",
      503,
    );
  }
}
