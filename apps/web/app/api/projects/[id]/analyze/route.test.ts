import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  expectForbidden,
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const getAnalysisPanelDataMock = vi.hoisted(() => vi.fn());
const triggerLlmAnalysisMock = vi.hoisted(() => vi.fn());
const clearProjectAnalysisMock = vi.hoisted(() => vi.fn());
const enqueueLlmAnalysisJobMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/suggestions", () => ({
  getAnalysisPanelData: getAnalysisPanelDataMock,
  triggerLlmAnalysis: triggerLlmAnalysisMock,
  clearProjectAnalysis: clearProjectAnalysisMock,
}));

vi.mock("@/lib/queue", () => ({
  enqueueLlmAnalysisJob: enqueueLlmAnalysisJobMock,
}));

import { DELETE, GET, POST } from "./route";

const ctx = routeContext({ id: "project-1" });

describe("GET /api/projects/[id]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(new Request("http://localhost"), ctx);
    expect(response.status).toBe(401);
  });

  it("returns analysis panel data", async () => {
    getAnalysisPanelDataMock.mockResolvedValue({
      analysisRun: {
        id: "run-1",
        projectId: "project-1",
        status: "COMPLETED",
        startedAt: new Date("2026-06-21T10:00:00Z"),
        completedAt: new Date("2026-06-21T10:05:00Z"),
        suggestionsCreated: 2,
        totalSteps: 10,
        completedSteps: 10,
        progressLabel: null,
        errorMessage: null,
      },
      pendingCount: 1,
      suggestions: [],
    });

    const data = await readJson<{
      analysisRun: { status: string };
      pendingCount: number;
    }>(await GET(new Request("http://localhost"), ctx), 200);

    expect(data.analysisRun?.status).toBe("COMPLETED");
    expect(data.pendingCount).toBe(1);
  });
});

describe("POST /api/projects/[id]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 403 for OPERATOR", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.OPERATOR),
    );

    await expectForbidden(await POST(new Request("http://localhost"), ctx));
    expect(triggerLlmAnalysisMock).not.toHaveBeenCalled();
  });

  it("returns 409 when analysis already running", async () => {
    triggerLlmAnalysisMock.mockResolvedValue({
      analysisRun: {
        id: "run-1",
        projectId: "project-1",
        status: "RUNNING",
        startedAt: new Date(),
        completedAt: null,
        suggestionsCreated: 0,
        totalSteps: 5,
        completedSteps: 2,
        progressLabel: "Embedding",
        errorMessage: null,
      },
      alreadyRunning: true,
    });

    const data = await readJson<{ message: string }>(
      await POST(new Request("http://localhost"), ctx),
      409,
    );
    expect(data.message).toContain("already");
    expect(enqueueLlmAnalysisJobMock).not.toHaveBeenCalled();
  });

  it("enqueues analysis and returns 202", async () => {
    triggerLlmAnalysisMock.mockResolvedValue({
      analysisRun: {
        id: "run-2",
        projectId: "project-1",
        status: "PENDING",
        startedAt: new Date(),
        completedAt: null,
        suggestionsCreated: 0,
        totalSteps: 0,
        completedSteps: 0,
        progressLabel: null,
        errorMessage: null,
      },
      alreadyRunning: false,
    });

    const data = await readJson<{ analysisRun: { id: string } }>(
      await POST(new Request("http://localhost"), ctx),
      202,
    );

    expect(data.analysisRun.id).toBe("run-2");
    expect(enqueueLlmAnalysisJobMock).toHaveBeenCalledWith({
      projectId: "project-1",
      analysisRunId: "run-2",
    });
  });

  it("allows LEAD to start analysis", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );
    triggerLlmAnalysisMock.mockResolvedValue({
      analysisRun: {
        id: "run-3",
        projectId: "project-1",
        status: "PENDING",
        startedAt: new Date(),
        completedAt: null,
        suggestionsCreated: 0,
        totalSteps: 0,
        completedSteps: 0,
        progressLabel: null,
        errorMessage: null,
      },
      alreadyRunning: false,
    });

    const data = await readJson<{ analysisRun: { id: string } }>(
      await POST(new Request("http://localhost"), ctx),
      202,
    );

    expect(data.analysisRun.id).toBe("run-3");
  });
});

describe("DELETE /api/projects/[id]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 403 for OPERATOR", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.OPERATOR),
    );

    await expectForbidden(await DELETE(new Request("http://localhost"), ctx));
    expect(clearProjectAnalysisMock).not.toHaveBeenCalled();
  });

  it("returns 409 when apply is in progress", async () => {
    clearProjectAnalysisMock.mockResolvedValue({
      cleared: false,
      reason: "A suggestion is being applied to VCS",
    });

    const data = await readJson<{ error: string }>(
      await DELETE(new Request("http://localhost"), ctx),
      409,
    );
    expect(data.error).toContain("applied");
  });

  it("clears analysis data", async () => {
    clearProjectAnalysisMock.mockResolvedValue({
      cleared: true,
      suggestionsDeleted: 3,
      runsDeleted: 1,
    });

    const data = await readJson<{
      cleared: boolean;
      suggestionsDeleted: number;
    }>(await DELETE(new Request("http://localhost"), ctx), 200);

    expect(data.cleared).toBe(true);
    expect(data.suggestionsDeleted).toBe(3);
  });

  it("allows LEAD to clear analysis", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );
    clearProjectAnalysisMock.mockResolvedValue({
      cleared: true,
      suggestionsDeleted: 1,
      runsDeleted: 1,
    });

    const data = await readJson<{ cleared: boolean }>(
      await DELETE(new Request("http://localhost"), ctx),
      200,
    );

    expect(data.cleared).toBe(true);
  });
});
