import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  expectForbidden,
  jsonRequest,
  readJson,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const listConnectionsMock = vi.hoisted(() => vi.fn());
const createConnectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  listConnections: listConnectionsMock,
  createConnection: createConnectionMock,
}));

import { GET, POST } from "./route";

describe("GET /api/connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(new Request("http://localhost/api/connections"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for VIEWER", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );

    await expectForbidden(
      await GET(new Request("http://localhost/api/connections")),
    );
    expect(listConnectionsMock).not.toHaveBeenCalled();
  });

  it("returns connections list", async () => {
    listConnectionsMock.mockResolvedValue([
      { id: "conn-1", name: "GitHub", accessToken: "secret" },
    ]);

    const data = await readJson<{ connections: { id: string }[] }>(
      await GET(new Request("http://localhost/api/connections")),
      200,
    );

    expect(data.connections).toHaveLength(1);
    expect(data.connections[0]?.id).toBe("conn-1");
  });
});

describe("POST /api/connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await POST(
      jsonRequest("POST", "http://localhost/api/connections", {}),
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for VIEWER", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );

    await expectForbidden(
      await POST(
        jsonRequest("POST", "http://localhost/api/connections", {
          name: "GitHub",
          provider: "GITHUB",
          accessToken: "ghp_test",
        }),
      ),
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when GitLab connection has no baseUrl", async () => {
    const response = await POST(
      jsonRequest("POST", "http://localhost/api/connections", {
        name: "GitLab",
        provider: "GITLAB",
        accessToken: "token",
      }),
    );

    const data = await readJson<{ error: string }>(response, 400);
    expect(data.error).toContain("baseUrl");
  });

  it("creates a connection", async () => {
    createConnectionMock.mockResolvedValue({
      id: "conn-1",
      name: "GitHub",
      provider: "GITHUB",
    });

    const data = await readJson<{ connection: { id: string } }>(
      await POST(
        jsonRequest("POST", "http://localhost/api/connections", {
          name: "GitHub",
          provider: "GITHUB",
          accessToken: "ghp_test",
        }),
      ),
      201,
    );

    expect(data.connection.id).toBe("conn-1");
    expect(createConnectionMock).toHaveBeenCalledWith(testAuthContext, {
      name: "GitHub",
      provider: "GITHUB",
      baseUrl: undefined,
      accessToken: "ghp_test",
    });
  });
});
