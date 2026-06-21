export const USER_ROLES = ["ADMIN", "LEAD", "OPERATOR", "VIEWER"] as const;

export type AppUserRole = (typeof USER_ROLES)[number];
