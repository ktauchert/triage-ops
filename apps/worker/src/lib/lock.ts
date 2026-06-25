import type { Redis } from "ioredis";

const LOCK_PREFIX = "triage-ops:lock:";

export function lockKey(resource: string): string {
  return `${LOCK_PREFIX}${resource}`;
}

export type LockHandle = {
  key: string;
  token: string;
  release: () => Promise<boolean>;
};

/**
 * Acquire a distributed lock with SET NX EX semantics.
 * Returns null when the lock is already held.
 */
export async function acquireLock(
  redis: Redis,
  resource: string,
  ttlSeconds = 300,
): Promise<LockHandle | null> {
  const key = lockKey(resource);
  const token = crypto.randomUUID();
  const acquired = await redis.set(key, token, "EX", ttlSeconds, "NX");

  if (acquired !== "OK") {
    return null;
  }

  return {
    key,
    token,
    release: () => releaseLock(redis, key, token),
  };
}

/** Extend the lock TTL only if we still own it (token match). */
export async function renewLock(
  redis: Redis,
  key: string,
  token: string,
  ttlSeconds: number,
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, key, token, String(ttlSeconds * 1000));
  return result === 1;
}

/**
 * Periodically renew a held lock so long-running jobs do not lose it when the
 * TTL elapses. Returns a stop function to call (in `finally`) before release.
 */
export function startLockHeartbeat(
  redis: Redis,
  handle: LockHandle,
  ttlSeconds = 300,
): () => void {
  const intervalMs = Math.max(1000, Math.floor((ttlSeconds * 1000) / 3));
  const timer = setInterval(() => {
    void renewLock(redis, handle.key, handle.token, ttlSeconds).catch(() => {
      /* best-effort renewal; lock TTL provides the safety net */
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}

/** Release lock only if we still own it (token match). */
export async function releaseLock(
  redis: Redis,
  key: string,
  token: string,
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, key, token);
  return result === 1;
}

export async function isLockHeld(
  redis: Redis,
  resource: string,
): Promise<boolean> {
  const exists = await redis.exists(lockKey(resource));
  return exists === 1;
}

/** Dev recovery when a worker dies mid-job and cannot release its lock. */
export async function forceReleaseLock(
  redis: Redis,
  resource: string,
): Promise<void> {
  await redis.del(lockKey(resource));
}
