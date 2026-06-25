import { UserRole, prisma } from "@triage-ops/db";
import { isEmailAllowed, normalizeEmail } from "./allowlist";
import { isAdminEmail, isAuthDisabled } from "./config";
import { isProductionEnvironment } from "./environment";
import { logAuditEvent } from "@/lib/services/audit";

const SETTINGS_ID = "default";

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function isSetupComplete(): Promise<boolean> {
  if (isAuthDisabled()) {
    return true;
  }

  const settings = await getAppSettings();
  return settings.setupComplete;
}

export async function completeSetup(userId: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      setupComplete: true,
      setupCompletedAt: new Date(),
      setupCompletedByUserId: userId,
    },
    create: {
      id: SETTINGS_ID,
      setupComplete: true,
      setupCompletedAt: new Date(),
      setupCompletedByUserId: userId,
    },
  });

  await logAuditEvent({
    userId,
    action: "instance.setup.complete",
    resourceType: "AppSettings",
    resourceId: SETTINGS_ID,
  });
}

export async function hasBootstrapAdmin(): Promise<boolean> {
  const count = await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });

  return count > 0;
}

export async function canSignInWithEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (isAuthDisabled()) {
    return true;
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  const setupComplete = await isSetupComplete();

  if (!setupComplete) {
    if (await hasBootstrapAdmin()) {
      return false;
    }

    // Defense in depth: when an allowlist is configured, restrict who can
    // claim a fresh instance during the bootstrap window. Without an
    // allowlist, the instance must only be reachable from a trusted network
    // until setup is complete.
    return isAllowlistConfigured() ? isEmailAllowed(normalized) : true;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, deactivatedAt: true },
  });

  if (existingUser) {
    if (existingUser.deactivatedAt) {
      return false;
    }

    return isAllowlistConfigured() ? isEmailAllowed(normalized) : true;
  }

  const provisioned = await prisma.provisionedUser.findUnique({
    where: { email: normalized },
    select: { id: true, claimedAt: true },
  });

  if (!provisioned || provisioned.claimedAt) {
    return false;
  }

  return isAllowlistConfigured() ? isEmailAllowed(normalized) : true;
}

export async function applySignInUserState(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  if (isAuthDisabled()) {
    return;
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return;
  }

  const setupComplete = await isSetupComplete();

  if (!setupComplete) {
    // Atomic first-wins claim: only the sign-in that flips setupComplete
    // false -> true becomes the bootstrap admin, preventing concurrent
    // sign-ins from each promoting themselves to ADMIN.
    const claim = await prisma.appSettings.updateMany({
      where: { id: SETTINGS_ID, setupComplete: false },
      data: {
        setupComplete: true,
        setupCompletedAt: new Date(),
        setupCompletedByUserId: userId,
      },
    });

    if (claim.count === 1) {
      await prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.ADMIN },
      });

      await logAuditEvent({
        userId,
        action: "instance.setup.complete",
        resourceType: "AppSettings",
        resourceId: SETTINGS_ID,
      });

      return;
    }

    // Lost the bootstrap race — fall through and treat this as a normal
    // sign-in (provisioned invite / admin-email handling below).
  }

  const provisioned = await prisma.provisionedUser.findUnique({
    where: { email: normalized },
  });

  if (provisioned && !provisioned.claimedAt) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: provisioned.role },
      }),
      prisma.provisionedUser.update({
        where: { id: provisioned.id },
        data: {
          claimedAt: new Date(),
          userId,
        },
      }),
    ]);

    await logAuditEvent({
      userId,
      action: "user.invite.claim",
      resourceType: "ProvisionedUser",
      resourceId: provisioned.id,
      metadata: {
        email: normalized,
        role: provisioned.role,
      },
    });
  }

  if (isAdminEmail(normalized)) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
    });
  }
}

export function isAllowlistConfigured(): boolean {
  const domains = process.env.ALLOWED_EMAIL_DOMAINS?.trim() ?? "";
  const emails = process.env.ALLOWED_EMAILS?.trim() ?? "";
  return domains.length > 0 || emails.length > 0;
}

export async function assertSetupAllowsApiAccess(): Promise<Response | null> {
  if (isAuthDisabled() || (await isSetupComplete())) {
    return null;
  }

  const { errorResponse } = await import("@/lib/api");
  return errorResponse("Instance setup is not complete", 503);
}

export function shouldDenyEmptyAllowlistInProduction(): boolean {
  return isProductionEnvironment() && !isAllowlistConfigured();
}

export function warnEmptyAllowlistInProduction(): void {
  if (!shouldDenyEmptyAllowlistInProduction()) {
    return;
  }

  console.warn(
    "[triage-ops] ALLOWED_EMAIL_DOMAINS and ALLOWED_EMAILS are both empty in production. " +
      "Configure an email/domain allowlist for defense in depth. " +
      "Closed registration still requires admin-provisioned invites for new users.",
  );
}
