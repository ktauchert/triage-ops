import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  jsonRequest,
  readJson,
  routeContext,
  testAuthContextWithRole,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const cancelPendingInviteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/admin", () => ({
  cancelPendingInvite: cancelPendingInviteMock,
}));

import { DELETE } from "./route";

describe("DELETE /api/admin/invites/[inviteId]", () => {
  const ctx = routeContext({ inviteId: "invite-1" });

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.ADMIN),
    );
  });

  it("returns 403 for non-admin", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );

    const response = await DELETE(
      jsonRequest("DELETE", "http://localhost"),
      ctx,
    );
    expect(response.status).toBe(403);
  });

  it("cancels a pending invite", async () => {
    cancelPendingInviteMock.mockResolvedValue({
      id: "invite-1",
      email: "bob@company.com",
      role: UserRole.VIEWER,
    });

    const data = await readJson<{ ok: boolean }>(
      await DELETE(jsonRequest("DELETE", "http://localhost"), ctx),
      200,
    );
    expect(data.ok).toBe(true);
    expect(cancelPendingInviteMock).toHaveBeenCalled();
  });
});
