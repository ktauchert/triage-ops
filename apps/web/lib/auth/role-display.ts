import type { AppUserRole } from "./roles";

const ROLE_LABELS: Record<AppUserRole, string> = {
  ADMIN: "Admin",
  LEAD: "Lead",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

const INVITE_ROLE_CAPABILITIES: Record<AppUserRole, string[]> = {
  ADMIN: [
    "Admin console",
    "Manage connections",
    "Register projects",
    "Trigger sync",
    "Run analysis",
    "Project settings",
    "Dismiss suggestions",
    "Apply to VCS",
  ],
  LEAD: [
    "Register projects",
    "Trigger sync",
    "Run analysis",
    "Project settings",
    "Dismiss suggestions",
    "Apply to VCS",
  ],
  OPERATOR: ["Apply to VCS", "View metrics"],
  VIEWER: ["Read-only", "View metrics & suggestions"],
};

export function formatUserRole(role: AppUserRole): string {
  return ROLE_LABELS[role];
}

export function getInviteRoleCapabilityLabels(role: AppUserRole): string[] {
  return INVITE_ROLE_CAPABILITIES[role];
}
