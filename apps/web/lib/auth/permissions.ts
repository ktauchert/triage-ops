import { UserRole } from "@triage-ops/db";
import { errorResponse } from "@/lib/api";
import type { AuthContext } from "./session";

export type Permission =
  | "connections.manage"
  | "projects.manage"
  | "project.sync"
  | "project.analyze"
  | "project.settings"
  | "suggestions.read"
  | "suggestion.dismiss"
  | "suggestion.apply"
  | "admin.users"
  | "admin.audit";

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
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

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export type RoleCapabilities = {
  canManageConnections: boolean;
  canManageProjects: boolean;
  canSync: boolean;
  canAnalyze: boolean;
  canEditSettings: boolean;
  canDismiss: boolean;
  canApply: boolean;
  canAdminUsers: boolean;
  canAdminAudit: boolean;
};

export function getRoleCapabilities(role: UserRole): RoleCapabilities {
  return {
    canManageConnections: hasPermission(role, "connections.manage"),
    canManageProjects: hasPermission(role, "projects.manage"),
    canSync: hasPermission(role, "project.sync"),
    canAnalyze: hasPermission(role, "project.analyze"),
    canEditSettings: hasPermission(role, "project.settings"),
    canDismiss: hasPermission(role, "suggestion.dismiss"),
    canApply: hasPermission(role, "suggestion.apply"),
    canAdminUsers: hasPermission(role, "admin.users"),
    canAdminAudit: hasPermission(role, "admin.audit"),
  };
}

export function getRoleCapabilityLabels(role: UserRole): string[] {
  const caps = getRoleCapabilities(role);
  const labels: string[] = [];

  if (caps.canAdminUsers) {
    labels.push("Admin console");
  }
  if (caps.canManageConnections) {
    labels.push("Manage connections");
  }
  if (caps.canManageProjects) {
    labels.push("Register projects");
  }
  if (caps.canSync) {
    labels.push("Trigger sync");
  }
  if (caps.canAnalyze) {
    labels.push("Run analysis");
  }
  if (caps.canEditSettings) {
    labels.push("Project settings");
  }
  if (caps.canDismiss) {
    labels.push("Dismiss suggestions");
  }
  if (caps.canApply) {
    labels.push("Apply to VCS");
  }

  if (role === UserRole.VIEWER) {
    return ["Read-only", "View metrics & suggestions"];
  }

  if (caps.canApply && !caps.canSync && !caps.canAnalyze) {
    labels.push("View metrics");
  }

  return labels;
}

export function requirePermission(
  ctx: AuthContext,
  permission: Permission,
): Response | null {
  if (hasPermission(ctx.role, permission)) {
    return null;
  }

  return errorResponse("Forbidden", 403);
}
