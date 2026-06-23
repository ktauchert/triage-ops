import { describe, expect, it } from "vitest";
import type { RoleCapabilities } from "@/lib/auth/permissions";
import {
  buildCommandPaletteItems,
  groupCommandPaletteItems,
} from "./command-palette";

const adminCaps: RoleCapabilities = {
  canManageConnections: true,
  canManageProjects: true,
  canSync: true,
  canAnalyze: true,
  canEditSettings: true,
  canDismiss: true,
  canApply: true,
  canAdminUsers: true,
  canAdminAudit: true,
};

const viewerCaps: RoleCapabilities = {
  canManageConnections: false,
  canManageProjects: false,
  canSync: false,
  canAnalyze: false,
  canEditSettings: false,
  canDismiss: false,
  canApply: false,
  canAdminUsers: false,
  canAdminAudit: false,
};

const projects = [
  {
    id: "p1",
    name: "Alpha",
    pathWithNamespace: "team/alpha",
    isFavorite: false,
  },
  {
    id: "p2",
    name: "Beta",
    pathWithNamespace: "team/beta",
    isFavorite: true,
  },
];

describe("buildCommandPaletteItems", () => {
  it("includes navigation and project entries for all roles", () => {
    const items = buildCommandPaletteItems(projects, viewerCaps);

    expect(items.some((item) => item.id === "nav-home")).toBe(true);
    expect(items.some((item) => item.id === "project-p1")).toBe(true);
    expect(items.some((item) => item.href === "/connections")).toBe(false);
    expect(items.some((item) => item.group === "Admin")).toBe(false);
  });

  it("includes admin and connection items for admins", () => {
    const items = buildCommandPaletteItems(projects, adminCaps);

    expect(items.some((item) => item.href === "/connections")).toBe(true);
    expect(items.some((item) => item.href === "/admin")).toBe(true);
    expect(items.some((item) => item.href === "/admin/users")).toBe(true);
    expect(items.some((item) => item.href === "/admin/audit")).toBe(true);
  });

  it("links projects to the project workspace route", () => {
    const items = buildCommandPaletteItems(projects, viewerCaps);

    expect(items.find((item) => item.id === "project-p1")?.href).toBe(
      "/project/p1",
    );
    expect(items.find((item) => item.id === "project-p2")?.href).toBe(
      "/project/p2",
    );
  });

  it("lists favorite projects before others", () => {
    const items = buildCommandPaletteItems(projects, viewerCaps);
    const projectItems = items.filter((item) => item.group === "Projects");

    expect(projectItems[0]?.id).toBe("project-p2");
  });
});

describe("groupCommandPaletteItems", () => {
  it("returns non-empty groups in display order", () => {
    const grouped = groupCommandPaletteItems(
      buildCommandPaletteItems(projects, adminCaps),
    );

    expect(grouped.map((entry) => entry.group)).toEqual([
      "Navigation",
      "Projects",
      "Admin",
    ]);
  });
});
