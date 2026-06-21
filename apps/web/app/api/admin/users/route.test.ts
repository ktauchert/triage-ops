import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  expectForbidden,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/admin", () => ({
  listUsers: listUsersMock,
}));

import { GET } from "./route";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.ADMIN),
    );
    listUsersMock.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 403 for LEAD", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );
    await expectForbidden(await GET());
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("returns users for admin", async () => {
    listUsersMock.mockResolvedValue([
      { id: "u1", email: "a@example.com", name: "A", role: UserRole.VIEWER },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].id).toBe("u1");
  });
});
