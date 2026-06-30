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
const listSyncRunsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  getProjectById: getProjectByIdMock,
  listSyncRuns: listSyncRunsMock,
}));

import { GET } from "./route";

const ctx = routeContext({ id: "project-1" });

describe("GET /api/projects/[id]/sync-runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
    getProjectByIdMock.mockResolvedValue({ id: "project-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(new Request("http://localhost"), ctx);
    expect(response.status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    getProjectByIdMock.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await GET(new Request("http://localhost"), ctx),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("allows VIEWER to read sync runs", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );
    listSyncRunsMock.mockResolvedValue([
      { id: "run-1", status: "COMPLETED" },
    ]);

    const data = await readJson<{ syncRuns: { id: string }[] }>(
      await GET(new Request("http://localhost"), ctx),
      200,
    );

    expect(data.syncRuns).toHaveLength(1);
  });

  it("returns sync run history", async () => {
    listSyncRunsMock.mockResolvedValue([
      { id: "run-1", status: "COMPLETED" },
    ]);

    const data = await readJson<{ syncRuns: { id: string }[] }>(
      await GET(new Request("http://localhost"), ctx),
      200,
    );

    expect(data.syncRuns[0]?.id).toBe("run-1");
  });
});
