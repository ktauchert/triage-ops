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
const listUsersMock = vi.hoisted(() => vi.fn());
const listPendingInvitesMock = vi.hoisted(() => vi.fn());
const updateUserRoleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/admin", () => ({
  listUsers: listUsersMock,
  listPendingInvites: listPendingInvitesMock,
  updateUserRole: updateUserRoleMock,
}));

import { GET } from "../route";
import { PATCH } from "./route";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.ADMIN),
    );
    listUsersMock.mockResolvedValue([]);
    listPendingInvitesMock.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns users for admin", async () => {
    listUsersMock.mockResolvedValue([
      { id: "u1", email: "a@example.com", name: "A", role: UserRole.VIEWER },
    ]);

    const data = await readJson<{ users: Array<{ id: string }> }>(
      await GET(),
      200,
    );
    expect(data.users).toHaveLength(1);
  });
});

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
});
