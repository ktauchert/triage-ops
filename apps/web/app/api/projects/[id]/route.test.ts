import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  expectForbidden,
  jsonRequest,
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const deleteProjectMock = vi.hoisted(() => vi.fn());
const updateProjectSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  deleteProject: deleteProjectMock,
  updateProjectSettings: updateProjectSettingsMock,
}));

import { DELETE, PATCH } from "./route";

const ctx = routeContext({ id: "project-1" });

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 403 for LEAD", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );

    await expectForbidden(
      await DELETE(new Request("http://localhost"), ctx),
    );
    expect(deleteProjectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when project not found", async () => {
    deleteProjectMock.mockResolvedValue(false);

    const data = await readJson<{ error: string }>(
      await DELETE(new Request("http://localhost"), ctx),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("deletes project", async () => {
    deleteProjectMock.mockResolvedValue(true);

    const data = await readJson<{ ok: boolean }>(
      await DELETE(new Request("http://localhost"), ctx),
      200,
    );
    expect(data.ok).toBe(true);
  });
});

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { ghostThresholdDays: 30 }),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 when no settings provided", async () => {
    const data = await readJson<{ error: string }>(
      await PATCH(jsonRequest("PATCH", "http://localhost", {}), ctx),
      400,
    );
    expect(data.error).toContain("Provide");
  });

  it("returns 403 for OPERATOR when updating settings", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.OPERATOR),
    );

    await expectForbidden(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { ghostThresholdDays: 30 }),
        ctx,
      ),
    );
    expect(updateProjectSettingsMock).not.toHaveBeenCalled();
  });

  it("allows LEAD to update favorite without settings permission", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );
    updateProjectSettingsMock.mockResolvedValue({
      id: "project-1",
      isFavorite: true,
    });

    const data = await readJson<{ project: { isFavorite: boolean } }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { isFavorite: true }),
        ctx,
      ),
      200,
    );

    expect(data.project.isFavorite).toBe(true);
    expect(updateProjectSettingsMock).toHaveBeenCalled();
  });

  it("updates metric thresholds", async () => {
    updateProjectSettingsMock.mockResolvedValue({
      id: "project-1",
      ghostThresholdDays: 45,
      zombieThresholdDays: 21,
    });

    const data = await readJson<{
      project: { ghostThresholdDays: number; zombieThresholdDays: number };
    }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", {
          ghostThresholdDays: 45,
          zombieThresholdDays: 21,
        }),
        ctx,
      ),
      200,
    );

    expect(data.project.ghostThresholdDays).toBe(45);
    expect(data.project.zombieThresholdDays).toBe(21);
  });
});
