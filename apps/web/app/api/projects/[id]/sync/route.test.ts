import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  expectForbidden,
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const getProjectByIdMock = vi.hoisted(() => vi.fn());
const triggerProjectSyncMock = vi.hoisted(() => vi.fn());
const enqueueSyncJobMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  getProjectById: getProjectByIdMock,
  triggerProjectSync: triggerProjectSyncMock,
}));

vi.mock("@/lib/queue", () => ({
  enqueueSyncJob: enqueueSyncJobMock,
}));

import { POST } from "./route";

const ctx = routeContext({ id: "project-1" });

describe("POST /api/projects/[id]/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
    getProjectByIdMock.mockResolvedValue({ id: "project-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await POST(new Request("http://localhost"), ctx);
    expect(response.status).toBe(401);
  });

  it("returns 403 for VIEWER", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );

    await expectForbidden(await POST(new Request("http://localhost"), ctx));
    expect(triggerProjectSyncMock).not.toHaveBeenCalled();
  });

  it("returns 404 when project not found", async () => {
    getProjectByIdMock.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await POST(new Request("http://localhost"), ctx),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("enqueues sync job and returns 202", async () => {
    triggerProjectSyncMock.mockResolvedValue({
      id: "run-1",
      status: "PENDING",
    });

    const data = await readJson<{ syncRun: { id: string } }>(
      await POST(new Request("http://localhost"), ctx),
      202,
    );

    expect(data.syncRun.id).toBe("run-1");
    expect(enqueueSyncJobMock).toHaveBeenCalledWith({
      projectId: "project-1",
      syncRunId: "run-1",
    });
  });

  it("allows LEAD to trigger sync", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );
    triggerProjectSyncMock.mockResolvedValue({
      id: "run-2",
      status: "PENDING",
    });

    const data = await readJson<{ syncRun: { id: string } }>(
      await POST(new Request("http://localhost"), ctx),
      202,
    );

    expect(data.syncRun.id).toBe("run-2");
  });
});
