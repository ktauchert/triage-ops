import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectForbidden,
  jsonRequest,
  readJson,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const listProjectsMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  vcsConnection: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  listProjects: listProjectsMock,
  createProject: createProjectMock,
}));

vi.mock("@gridnull/db", () => ({
  VcsProvider: { GITLAB: "GITLAB", GITHUB: "GITHUB" },
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/access", () => ({
  canAccessConnection: vi.fn().mockReturnValue(true),
}));

import { GET, POST } from "./route";

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns projects list", async () => {
    listProjectsMock.mockResolvedValue([{ id: "project-1", name: "Demo" }]);

    const data = await readJson<{ projects: { id: string }[] }>(
      await GET(),
      200,
    );
    expect(data.projects[0]?.id).toBe("project-1");
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 403 for VIEWER", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole("VIEWER"),
    );

    await expectForbidden(
      await POST(
        jsonRequest("POST", "http://localhost/api/projects", {
          connectionId: "conn-1",
          pathWithNamespace: "org/repo",
          name: "Repo",
        }),
      ),
    );
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when connection not found", async () => {
    prismaMock.vcsConnection.findUnique.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await POST(
        jsonRequest("POST", "http://localhost/api/projects", {
          connectionId: "missing",
          pathWithNamespace: "org/repo",
          name: "Repo",
        }),
      ),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("returns 400 when GitHub project includes externalProjectId", async () => {
    prismaMock.vcsConnection.findUnique.mockResolvedValue({
      provider: "GITHUB",
      userId: "user-test",
    });

    const data = await readJson<{ error: string }>(
      await POST(
        jsonRequest("POST", "http://localhost/api/projects", {
          connectionId: "conn-1",
          pathWithNamespace: "org/repo",
          name: "Repo",
          externalProjectId: 123,
        }),
      ),
      400,
    );
    expect(data.error).toContain("not used for GitHub");
  });

  it("creates a GitLab project", async () => {
    prismaMock.vcsConnection.findUnique.mockResolvedValue({
      provider: "GITLAB",
      userId: "user-test",
    });
    createProjectMock.mockResolvedValue({
      id: "project-1",
      pathWithNamespace: "group/demo",
    });

    const data = await readJson<{ project: { id: string } }>(
      await POST(
        jsonRequest("POST", "http://localhost/api/projects", {
          connectionId: "conn-1",
          pathWithNamespace: "group/demo",
          name: "Demo",
          externalProjectId: 42,
        }),
      ),
      201,
    );

    expect(data.project.id).toBe("project-1");
    expect(createProjectMock).toHaveBeenCalled();
  });
});
