import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./dev-user", () => ({
  ensureDevUser: vi.fn().mockResolvedValue("dev-local"),
}));

vi.mock("./setup", () => ({
  assertSetupAllowsApiAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock("@triage-ops/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@triage-ops/db")>();
  return {
    ...actual,
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ role: "LEAD" }),
      },
    },
  };
});

import { auth } from "@/auth";
import { UserRole } from "@triage-ops/db";
import { requireApiSession } from "./session";

const mockedAuth = vi.mocked(auth);

describe("requireApiSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns dev context when auth is disabled", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");

    const session = await requireApiSession();
    if (session instanceof Response) {
      throw new Error("Expected AuthContext");
    }

    expect(session.userId).toBe("dev-local");
    expect(session.dataScope).toBe("shared");
    expect(session.role).toBe(UserRole.ADMIN);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is enabled and session is missing", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    mockedAuth.mockResolvedValue(null);

    const session = await requireApiSession();
    expect(session).toBeInstanceOf(Response);
    if (session instanceof Response) {
      expect(session.status).toBe(401);
    }
  });

  it("returns auth context when session exists", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_DATA_SCOPE", "per_user");
    mockedAuth.mockResolvedValue({
      user: {
        id: "user-abc",
        email: "alice@company.com",
        name: "Alice",
      },
      expires: new Date().toISOString(),
    });

    const session = await requireApiSession();
    if (session instanceof Response) {
      throw new Error("Expected AuthContext");
    }

    expect(session).toEqual({
      userId: "user-abc",
      role: UserRole.LEAD,
      dataScope: "per_user",
      email: "alice@company.com",
      name: "Alice",
    });
  });
});
