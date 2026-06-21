import { beforeEach, describe, expect, it, vi } from "vitest";
import { acquireLock, isLockHeld, releaseLock } from "./lock.js";

type MockRedis = {
  set: ReturnType<typeof vi.fn>;
  eval: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

function createMockRedis(): MockRedis {
  return {
    set: vi.fn(),
    eval: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
  };
}

describe("acquireLock", () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it("returns a lock handle when SET NX succeeds", async () => {
    redis.set.mockResolvedValue("OK");

    const lock = await acquireLock(redis as never, "project:abc");

    expect(lock).not.toBeNull();
    expect(lock?.key).toBe("triage-ops:lock:project:abc");
    expect(redis.set).toHaveBeenCalledWith(
      "triage-ops:lock:project:abc",
      expect.any(String),
      "EX",
      300,
      "NX",
    );
  });

  it("returns null when lock is already held", async () => {
    redis.set.mockResolvedValue(null);

    const lock = await acquireLock(redis as never, "project:abc");

    expect(lock).toBeNull();
  });
});

describe("isLockHeld", () => {
  it("returns true when the lock key exists", async () => {
    const redis = createMockRedis();
    redis.exists = vi.fn().mockResolvedValue(1);

    await expect(isLockHeld(redis as never, "llm:project-1")).resolves.toBe(true);
    expect(redis.exists).toHaveBeenCalledWith("triage-ops:lock:llm:project-1");
  });
});

describe("releaseLock", () => {
  it("returns true when token matches and lock is deleted", async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);

    const released = await releaseLock(
      redis as never,
      "triage-ops:lock:project:abc",
      "token-123",
    );

    expect(released).toBe(true);
    expect(redis.eval).toHaveBeenCalled();
  });

  it("returns false when token does not match", async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(0);

    const released = await releaseLock(
      redis as never,
      "triage-ops:lock:project:abc",
      "wrong-token",
    );

    expect(released).toBe(false);
  });
});
