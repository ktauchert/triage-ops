import { describe, expect, it } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  getRoleCapabilities,
  hasPermission,
  type Permission,
} from "./permissions";

const ALL_PERMISSIONS: Permission[] = [
  "connections.manage",
  "projects.manage",
  "project.sync",
  "project.analyze",
  "project.settings",
  "suggestions.read",
  "suggestion.dismiss",
  "suggestion.apply",
  "admin.users",
  "admin.audit",
];

const EXPECTED_MATRIX: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "connections.manage",
    "projects.manage",
    "project.sync",
    "project.analyze",
    "project.settings",
    "suggestions.read",
    "suggestion.dismiss",
    "suggestion.apply",
    "admin.users",
    "admin.audit",
  ],
  LEAD: [
    "project.sync",
    "project.analyze",
    "project.settings",
    "suggestions.read",
    "suggestion.dismiss",
    "suggestion.apply",
  ],
  OPERATOR: ["suggestions.read", "suggestion.apply"],
  VIEWER: ["suggestions.read"],
};

const ALL_ROLES = Object.values(UserRole);

describe("permission matrix", () => {
  it.each(
    ALL_ROLES.flatMap((role) =>
      ALL_PERMISSIONS.map((permission) => [role, permission] as const),
    ),
  )("%s hasPermission(%s)", (role, permission) => {
    const expected = EXPECTED_MATRIX[role].includes(permission);
    expect(hasPermission(role, permission)).toBe(expected);
  });
});

describe("getRoleCapabilities", () => {
  it.each(ALL_ROLES)("%s matches hasPermission-derived capabilities", (role) => {
    expect(getRoleCapabilities(role)).toEqual({
      canManageConnections: hasPermission(role, "connections.manage"),
      canManageProjects: hasPermission(role, "projects.manage"),
      canSync: hasPermission(role, "project.sync"),
      canAnalyze: hasPermission(role, "project.analyze"),
      canEditSettings: hasPermission(role, "project.settings"),
      canDismiss: hasPermission(role, "suggestion.dismiss"),
      canApply: hasPermission(role, "suggestion.apply"),
      canAdminUsers: hasPermission(role, "admin.users"),
      canAdminAudit: hasPermission(role, "admin.audit"),
    });
  });
});
