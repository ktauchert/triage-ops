import { UserRole, prisma } from "@triage-ops/db";
import { isEmailAllowed, normalizeEmail } from "./allowlist";
import { isAdminEmail, isAuthDisabled } from "./config";
import { isProductionEnvironment } from "./environment";

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
    return !(await hasBootstrapAdmin());
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
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
    });
    await completeSetup(userId);
    return;
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
