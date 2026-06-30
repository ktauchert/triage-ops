import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireLock,
  isLockHeld,
  releaseLock,
  renewLock,
  startLockHeartbeat,
} from "./lock.js";

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
    expect(lock?.key).toBe("gridnull:lock:project:abc");
    expect(redis.set).toHaveBeenCalledWith(
      "gridnull:lock:project:abc",
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
    expect(redis.exists).toHaveBeenCalledWith("gridnull:lock:llm:project-1");
  });
});

describe("releaseLock", () => {
  it("returns true when token matches and lock is deleted", async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);

    const released = await releaseLock(
      redis as never,
      "gridnull:lock:project:abc",
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
      "gridnull:lock:project:abc",
      "wrong-token",
    );

    expect(released).toBe(false);
  });
});

describe("renewLock", () => {
  it("pexpires the key with the token guard and ttl in ms", async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);

    const renewed = await renewLock(
      redis as never,
      "gridnull:lock:project:abc",
      "token-123",
      300,
    );

    expect(renewed).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("pexpire"),
      1,
      "gridnull:lock:project:abc",
      "token-123",
      "300000",
    );
  });
});

describe("startLockHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renews the lock on each interval and stops when asked", async () => {
    const redis = createMockRedis();
    redis.eval.mockResolvedValue(1);

    const stop = startLockHeartbeat(
      redis as never,
      { key: "gridnull:lock:sync:p1", token: "t1", release: async () => true },
      300,
    );

    await vi.advanceTimersByTimeAsync(100_000);
    expect(redis.eval).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(redis.eval).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
