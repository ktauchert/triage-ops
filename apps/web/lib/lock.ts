import type Redis from "ioredis";

const LOCK_PREFIX = "gridnull:lock:";

export function lockKey(resource: string): string {
  return `${LOCK_PREFIX}${resource}`;
}

export async function isLockHeld(
  redis: Redis,
  resource: string,
): Promise<boolean> {
  const exists = await redis.exists(lockKey(resource));
  return exists === 1;
}

export async function forceReleaseLock(
  redis: Redis,
  resource: string,
): Promise<void> {
  await redis.del(lockKey(resource));
}
