import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  jsonRequest,
  readJson,
  routeContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const updateUserRoleMock = vi.hoisted(() => vi.fn());
const setUserDeactivatedMock = vi.hoisted(() => vi.fn());
const deleteUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/admin", () => ({
  updateUserRole: updateUserRoleMock,
  setUserDeactivated: setUserDeactivatedMock,
  deleteUser: deleteUserMock,
}));

import { DELETE, PATCH } from "./route";

describe("PATCH /api/admin/users/[userId]", () => {
  const ctx = routeContext({ userId: "user-2" });

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.ADMIN),
    );
  });

  it("returns 403 for non-admin", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { role: "VIEWER" }),
      ctx,
    );
    expect(response.status).toBe(403);
  });

  it("updates role for admin", async () => {
    updateUserRoleMock.mockResolvedValue({
      id: "user-2",
      email: "b@example.com",
      role: UserRole.OPERATOR,
      deactivatedAt: null,
    });

    const data = await readJson<{ user: { role: string } }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { role: "OPERATOR" }),
        ctx,
      ),
      200,
    );
    expect(data.user.role).toBe("OPERATOR");
  });

  it("deactivates a user", async () => {
    setUserDeactivatedMock.mockResolvedValue({
      id: "user-2",
      email: "b@example.com",
      role: UserRole.VIEWER,
      deactivatedAt: new Date("2026-06-23T00:00:00.000Z"),
    });

    const data = await readJson<{ user: { deactivatedAt: string | null } }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { deactivated: true }),
        ctx,
      ),
      200,
    );
    expect(data.user.deactivatedAt).toBeTruthy();
    expect(setUserDeactivatedMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ADMIN }),
      "user-2",
      true,
    );
  });
});

describe("DELETE /api/admin/users/[userId]", () => {
  const ctx = routeContext({ userId: "user-2" });

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.ADMIN),
    );
    deleteUserMock.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());
    const response = await DELETE(
      jsonRequest("DELETE", "http://localhost"),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("deletes a user for admin", async () => {
    const data = await readJson<{ ok: boolean }>(
      await DELETE(jsonRequest("DELETE", "http://localhost"), ctx),
      200,
    );
    expect(data.ok).toBe(true);
    expect(deleteUserMock).toHaveBeenCalled();
  });
});
