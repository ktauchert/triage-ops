import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  appSettings: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  provisionedUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@triage-ops/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@triage-ops/db")>();
  return {
    ...actual,
    prisma: prismaMock,
  };
});

vi.mock("./config", () => ({
  isAuthDisabled: vi.fn().mockReturnValue(false),
  isAdminEmail: vi.fn().mockReturnValue(false),
}));

vi.mock("./allowlist", () => ({
  isEmailAllowed: vi.fn().mockReturnValue(true),
  normalizeEmail: (email: string | null | undefined) =>
    email?.trim().toLowerCase() ?? null,
}));

vi.mock("./setup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./setup")>();
  return {
    ...actual,
    isAllowlistConfigured: vi.fn().mockReturnValue(false),
  };
});

vi.mock("@/lib/services/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { isAuthDisabled } from "./config";
import { isEmailAllowed } from "./allowlist";
import {
  applySignInUserState,
  canSignInWithEmail,
  completeSetup,
  isSetupComplete,
} from "./setup";

describe("setup auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthDisabled).mockReturnValue(false);
    vi.mocked(isEmailAllowed).mockReturnValue(true);
    prismaMock.appSettings.upsert.mockResolvedValue({
      id: "default",
      setupComplete: false,
    });
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.provisionedUser.findUnique.mockResolvedValue(null);
    prismaMock.appSettings.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.update.mockResolvedValue({ id: "u1" });
  });

  it("reports setup complete when settings flag is true", async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({
      id: "default",
      setupComplete: true,
    });

    await expect(isSetupComplete()).resolves.toBe(true);
  });

  it("allows bootstrap sign-in before first admin exists", async () => {
    await expect(canSignInWithEmail("admin@company.com")).resolves.toBe(true);
    expect(isEmailAllowed).not.toHaveBeenCalled();
  });

  it("denies bootstrap sign-in once an admin exists but setup is incomplete", async () => {
    prismaMock.user.count.mockResolvedValue(1);

    await expect(canSignInWithEmail("admin@company.com")).resolves.toBe(false);
  });

  it("requires provisioned email after setup is complete", async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({
      id: "default",
      setupComplete: true,
    });

    await expect(canSignInWithEmail("new@company.com")).resolves.toBe(false);
  });

  it("allows returning users after setup", async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({
      id: "default",
      setupComplete: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      deactivatedAt: null,
    });

    await expect(canSignInWithEmail("alice@company.com")).resolves.toBe(true);
  });

  it("denies deactivated users after setup", async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({
      id: "default",
      setupComplete: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      deactivatedAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    await expect(canSignInWithEmail("alice@company.com")).resolves.toBe(false);
  });

  it("allows pending invite after setup", async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({
      id: "default",
      setupComplete: true,
    });
    prismaMock.provisionedUser.findUnique.mockResolvedValue({
      id: "invite-1",
      claimedAt: null,
    });

    await expect(canSignInWithEmail("bob@company.com")).resolves.toBe(true);
  });

  it("marks setup complete with admin user", async () => {
    await completeSetup("admin-1");

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "default" },
        update: expect.objectContaining({
          setupComplete: true,
          setupCompletedByUserId: "admin-1",
        }),
      }),
    );
  });

  it("short-circuits when auth is disabled", async () => {
    vi.mocked(isAuthDisabled).mockReturnValue(true);
    await expect(isSetupComplete()).resolves.toBe(true);
    await expect(canSignInWithEmail("any@example.com")).resolves.toBe(true);
  });

  it("enforces the allowlist during bootstrap when configured", async () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "company.com");
    vi.mocked(isEmailAllowed).mockReturnValue(false);

    await expect(canSignInWithEmail("outsider@evil.com")).resolves.toBe(false);

    vi.unstubAllEnvs();
  });

  it("promotes the bootstrap winner to ADMIN exactly once", async () => {
    prismaMock.appSettings.updateMany.mockResolvedValue({ count: 1 });

    await applySignInUserState("first-user", "first@company.com");

    expect(prismaMock.appSettings.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "default", setupComplete: false },
      }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "first-user" },
      data: { role: "ADMIN" },
    });
  });

  it("does not promote a user that loses the bootstrap race", async () => {
    prismaMock.appSettings.updateMany.mockResolvedValue({ count: 0 });

    await applySignInUserState("second-user", "second@company.com");

    expect(prismaMock.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "ADMIN" } }),
    );
  });
});
