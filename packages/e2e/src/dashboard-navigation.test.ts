import { UserRole, VcsProvider, prisma } from "@triage-ops/db";
import { DEFAULT_GITHUB_API_URL } from "@triage-ops/shared-types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCommandPaletteItems } from "@/lib/command-palette";
import type { AuthContext } from "@/lib/auth/session";
import { getRoleCapabilities } from "@/lib/auth/permissions";
import {
  legacyProjectRedirectPath,
  projectDashboardPath,
} from "@/lib/navigation";
import { getProjectById } from "@/lib/services/projects";
import { getHomeSummary } from "@/lib/services/home";
import { getProjectMetrics } from "@/lib/services/metrics";

const NAV_CONNECTION_NAME = "e2e-dashboard-nav-github";
const NAV_OWNER = "nav-org";
const NAV_REPO = "nav-repo";
const NAV_REPO_PATH = `${NAV_OWNER}/${NAV_REPO}`;

const adminContext: AuthContext = {
  userId: "e2e-nav-admin",
  role: UserRole.ADMIN,
  dataScope: "shared",
  email: "nav-admin@example.com",
  name: "Nav Admin",
};

describe("e2e: home → project workspace navigation", () => {
  let projectId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for e2e navigation tests");
    }

    await prisma.vcsConnection.deleteMany({
      where: { name: NAV_CONNECTION_NAME },
    });

    const connection = await prisma.vcsConnection.create({
      data: {
        name: NAV_CONNECTION_NAME,
        provider: VcsProvider.GITHUB,
        baseUrl: DEFAULT_GITHUB_API_URL,
        accessToken: "ghp-e2e-nav-token",
      },
    });

    const project = await prisma.project.create({
      data: {
        connectionId: connection.id,
        pathWithNamespace: NAV_REPO_PATH,
        name: "E2E Navigation Repo",
        isFavorite: true,
      },
    });

    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.vcsConnection.deleteMany({
      where: { name: NAV_CONNECTION_NAME },
    });
    await prisma.$disconnect();
  });

  it("shows starred project on home and opens project workspace route", async () => {
    const summary = await getHomeSummary(adminContext);
    const favorite = summary.favoriteProjects.find(
      (project) => project.id === projectId,
    );

    expect(favorite).toBeDefined();
    expect(projectDashboardPath(projectId)).toBe(`/project/${projectId}`);
    expect(legacyProjectRedirectPath(projectId)).toBe(`/project/${projectId}`);

    const project = await getProjectById(adminContext, projectId);
    expect(project?.name).toBe("E2E Navigation Repo");

    const metrics = await getProjectMetrics(projectId);
    expect(metrics?.projectId).toBe(projectId);
  });

  it("includes the project workspace in command palette navigation", async () => {
    const projects = await prisma.project.findMany({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        pathWithNamespace: true,
        isFavorite: true,
      },
    });

    const items = buildCommandPaletteItems(
      projects,
      getRoleCapabilities(adminContext.role),
    );

    expect(items.find((item) => item.id === `project-${projectId}`)?.href).toBe(
      `/project/${projectId}`,
    );
  });
});
