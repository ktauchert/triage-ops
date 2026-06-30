import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const getProjectByIdMock = vi.hoisted(() => vi.fn());
const getProjectMetricsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  getProjectById: getProjectByIdMock,
}));

vi.mock("@/lib/services/metrics", () => ({
  getProjectMetrics: getProjectMetricsMock,
}));

import { GET } from "./route";

const ctx = routeContext({ id: "project-1" });

describe("GET /api/projects/[id]/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
    getProjectByIdMock.mockResolvedValue({ id: "project-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(
      new Request("http://localhost/api/projects/project-1/metrics"),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    getProjectByIdMock.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await GET(
        new Request("http://localhost/api/projects/project-1/metrics"),
        ctx,
      ),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("allows VIEWER to read metrics", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );
    getProjectMetricsMock.mockResolvedValue({
      overview: { totalIssues: 5, openIssues: 3 },
      stale: { count: 1 },
      stuck: { count: 0 },
      milestoneDecay: { count: 0 },
    });

    const data = await readJson<{
      metrics: { overview: { totalIssues: number } };
    }>(
      await GET(
        new Request("http://localhost/api/projects/project-1/metrics"),
        ctx,
      ),
      200,
    );

    expect(data.metrics.overview.totalIssues).toBe(5);
  });

  it("returns metrics payload", async () => {
    getProjectMetricsMock.mockResolvedValue({
      overview: { totalIssues: 10, openIssues: 6 },
      stale: { count: 2 },
      stuck: { count: 1 },
      milestoneDecay: { count: 1 },
    });

    const data = await readJson<{
      metrics: { overview: { totalIssues: number }; stale: { count: number } };
    }>(
      await GET(
        new Request(
          "http://localhost/api/projects/project-1/metrics?staleDays=30",
        ),
        ctx,
      ),
      200,
    );

    expect(data.metrics.overview.totalIssues).toBe(10);
    expect(data.metrics.stale.count).toBe(2);
    expect(getProjectMetricsMock).toHaveBeenCalledWith("project-1", {
      staleDays: 30,
      stuckDays: undefined,
    });
  });
});
