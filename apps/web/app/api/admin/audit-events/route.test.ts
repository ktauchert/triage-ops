import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const listAuditEventsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/audit", () => ({
  listAuditEvents: listAuditEventsMock,
}));

import { GET } from "./route";

describe("GET /api/admin/audit-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.ADMIN),
    );
    listAuditEventsMock.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());
    const response = await GET(new Request("http://localhost/api/admin/audit-events"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );
    const response = await GET(new Request("http://localhost/api/admin/audit-events"));
    expect(response.status).toBe(403);
  });

  it("returns events for admin", async () => {
    listAuditEventsMock.mockResolvedValue([
      {
        id: "evt-1",
        action: "suggestion.apply",
        resourceType: "IssueSuggestion",
        resourceId: "s1",
        metadata: null,
        createdAt: new Date("2026-06-21T12:00:00.000Z"),
        user: { id: "u1", email: "a@example.com", name: "A" },
      },
    ]);

    const response = await GET(new Request("http://localhost/api/admin/audit-events"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].action).toBe("suggestion.apply");
  });
});
