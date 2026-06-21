import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  expectForbidden,
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const getConnectionCredentialsMock = vi.hoisted(() => vi.fn());
const listRemoteProjectsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/connections", () => ({
  getConnectionCredentials: getConnectionCredentialsMock,
}));

vi.mock("@/lib/vcs/list-remote-projects", () => ({
  listRemoteProjects: listRemoteProjectsMock,
}));

import { GET } from "./route";

const ctx = routeContext({ id: "conn-1" });

describe("GET /api/connections/[id]/remote-projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
    getConnectionCredentialsMock.mockResolvedValue({
      provider: "GITHUB",
      baseUrl: "https://api.github.com",
      accessToken: "token",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(new Request("http://localhost"), ctx);
    expect(response.status).toBe(401);
  });

  it("returns 404 when connection not found", async () => {
    getConnectionCredentialsMock.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await GET(new Request("http://localhost"), ctx),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("returns 403 for OPERATOR", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.OPERATOR),
    );

    await expectForbidden(
      await GET(new Request("http://localhost"), ctx),
    );
    expect(listRemoteProjectsMock).not.toHaveBeenCalled();
  });

  it("returns remote projects", async () => {
    listRemoteProjectsMock.mockResolvedValue([
      { pathWithNamespace: "org/repo", name: "repo" },
    ]);

    const data = await readJson<{
      projects: { pathWithNamespace: string }[];
    }>(await GET(new Request("http://localhost"), ctx), 200);

    expect(data.projects).toHaveLength(1);
    expect(listRemoteProjectsMock).toHaveBeenCalled();
  });

  it("returns 502 when VCS listing fails", async () => {
    listRemoteProjectsMock.mockRejectedValue(new Error("GitHub API down"));

    const data = await readJson<{ error: string }>(
      await GET(new Request("http://localhost"), ctx),
      502,
    );
    expect(data.error).toContain("GitHub API down");
  });
});
