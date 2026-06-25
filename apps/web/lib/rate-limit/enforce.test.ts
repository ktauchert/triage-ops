import { afterEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: () => redisMock,
}));

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    isRateLimitEnabled: vi.fn().mockReturnValue(true),
    getRateLimitWindowSeconds: vi.fn().mockReturnValue(60),
    getRateLimitMaxForTier: vi.fn((tier: string) => {
      if (tier === "sync") {
        return 2;
      }
      return 100;
    }),
    getRateLimitTiersForPath: vi.fn().mockReturnValue(["default", "sync"]),
  };
});

import { enforceApiRateLimit } from "./enforce";

describe("enforceApiRateLimit", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when tier limit is exceeded", async () => {
    redisMock.incr.mockResolvedValueOnce(101).mockResolvedValueOnce(3);

    const request = new Request("http://localhost/api/projects/p1/sync", {
      method: "POST",
    });

    const response = await enforceApiRateLimit(request, "user-1");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("100");
  });

  it("allows requests under the limit", async () => {
    redisMock.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const request = new Request("http://localhost/api/projects/p1/sync", {
      method: "POST",
    });

    const response = await enforceApiRateLimit(request, "user-1");
    expect(response).toBeNull();
  });
});
