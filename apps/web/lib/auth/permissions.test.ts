import { describe, expect, it } from "vitest";
import { UserRole } from "@triage-ops/db";
import {
  getRoleCapabilities,
  getRoleCapabilityLabels,
  hasPermission,
  requirePermission,
} from "./permissions";
import type { AuthContext } from "./session";

function ctx(role: UserRole): AuthContext {
  return {
    userId: "user-1",
    role,
    dataScope: "shared",
    email: "test@example.com",
    name: "Test",
  };
}

describe("hasPermission", () => {
  it("grants ADMIN all permissions", () => {
    expect(hasPermission(UserRole.ADMIN, "connections.manage")).toBe(true);
    expect(hasPermission(UserRole.ADMIN, "admin.audit")).toBe(true);
  });

  it("restricts VIEWER to read-only suggestions", () => {
    expect(hasPermission(UserRole.VIEWER, "suggestions.read")).toBe(true);
    expect(hasPermission(UserRole.VIEWER, "suggestion.apply")).toBe(false);
    expect(hasPermission(UserRole.VIEWER, "project.sync")).toBe(false);
  });

  it("allows OPERATOR to apply but not dismiss", () => {
    expect(hasPermission(UserRole.OPERATOR, "suggestion.apply")).toBe(true);
    expect(hasPermission(UserRole.OPERATOR, "suggestion.dismiss")).toBe(false);
  });

  it("allows LEAD to analyze and dismiss", () => {
    expect(hasPermission(UserRole.LEAD, "project.analyze")).toBe(true);
    expect(hasPermission(UserRole.LEAD, "suggestion.dismiss")).toBe(true);
    expect(hasPermission(UserRole.LEAD, "connections.manage")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("returns null when allowed", () => {
    expect(requirePermission(ctx(UserRole.ADMIN), "admin.users")).toBeNull();
  });

  it("returns 403 when denied", () => {
    const response = requirePermission(ctx(UserRole.VIEWER), "suggestion.apply");
    expect(response).toBeInstanceOf(Response);
    if (response instanceof Response) {
      expect(response.status).toBe(403);
    }
  });
});

describe("getRoleCapabilities", () => {
  it("maps OPERATOR capabilities", () => {
    expect(getRoleCapabilities(UserRole.OPERATOR)).toEqual({
      canManageConnections: false,
      canManageProjects: false,
      canSync: false,
      canAnalyze: false,
      canEditSettings: false,
      canDismiss: false,
      canApply: true,
      canAdminUsers: false,
      canAdminAudit: false,
    });
  });
});

describe("getRoleCapabilityLabels", () => {
  it("describes VIEWER as read-only", () => {
    expect(getRoleCapabilityLabels(UserRole.VIEWER)).toEqual([
      "Read-only",
      "View metrics & suggestions",
    ]);
  });

  it("describes OPERATOR apply-focused access", () => {
    expect(getRoleCapabilityLabels(UserRole.OPERATOR)).toEqual([
      "Apply to VCS",
      "View metrics",
    ]);
  });

  it("includes admin and management labels for ADMIN", () => {
    const labels = getRoleCapabilityLabels(UserRole.ADMIN);
    expect(labels).toContain("Admin console");
    expect(labels).toContain("Manage connections");
    expect(labels).toContain("Apply to VCS");
  });
});
