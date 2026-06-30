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

vi.mock("@/lib/rate-limit/enforce", () => ({
  enforceApiRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@gridnull/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gridnull/db")>();
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
import { UserRole, prisma } from "@gridnull/db";
import { requireApiSession } from "./session";

const mockedAuth = vi.mocked(auth);
const mockedFindUnique = vi.mocked(prisma.user.findUnique);

describe("requireApiSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns dev context when auth is disabled", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");

    const session = await requireApiSession(
      new Request("http://localhost/api/test"),
    );
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

    const session = await requireApiSession(
      new Request("http://localhost/api/test"),
    );
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

    const session = await requireApiSession(
      new Request("http://localhost/api/test"),
    );
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

  it("returns 401 when the user has been deactivated", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    mockedAuth.mockResolvedValue({
      user: { id: "user-abc", email: "alice@company.com", name: "Alice" },
      expires: new Date().toISOString(),
    });
    mockedFindUnique.mockResolvedValue({
      role: UserRole.LEAD,
      deactivatedAt: new Date(),
    } as never);

    const session = await requireApiSession(
      new Request("http://localhost/api/test"),
    );
    expect(session).toBeInstanceOf(Response);
    if (session instanceof Response) {
      expect(session.status).toBe(401);
    }
  });

  it("returns 401 when the user no longer exists", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    mockedAuth.mockResolvedValue({
      user: { id: "ghost", email: "ghost@company.com", name: "Ghost" },
      expires: new Date().toISOString(),
    });
    mockedFindUnique.mockResolvedValue(null);

    const session = await requireApiSession(
      new Request("http://localhost/api/test"),
    );
    expect(session).toBeInstanceOf(Response);
    if (session instanceof Response) {
      expect(session.status).toBe(401);
    }
  });
});
