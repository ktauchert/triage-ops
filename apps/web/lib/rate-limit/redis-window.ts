import type Redis from "ioredis";
import { getRedis } from "@/lib/redis";
import type { RateLimitTier } from "./config";
import { getRateLimitMaxForTier, getRateLimitWindowSeconds } from "./config";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

function windowStart(nowMs: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

export async function checkRateLimitWindow(
  redis: Redis,
  tier: RateLimitTier,
  identifier: string,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const windowSeconds = getRateLimitWindowSeconds();
  const limit = getRateLimitMaxForTier(tier);
  const start = windowStart(nowMs, windowSeconds);
  const key = `ratelimit:${tier}:${identifier}:${start}`;
  const resetAt = Math.ceil((start + windowSeconds * 1000) / 1000);

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  const remaining = Math.max(limit - count, 0);

  return {
    allowed: count <= limit,
    limit,
    remaining,
    resetAt,
  };
}

export async function consumeRateLimitTiers(
  tiers: RateLimitTier[],
  identifier: string,
): Promise<RateLimitResult | null> {
  let strictest: RateLimitResult | null = null;

  for (const tier of tiers) {
    const result = await checkRateLimitWindow(getRedis(), tier, identifier);
    if (!result.allowed) {
      return result;
    }

    if (
      !strictest ||
      result.remaining < strictest.remaining ||
      (result.remaining === strictest.remaining &&
        result.resetAt < strictest.resetAt)
    ) {
      strictest = result;
    }
  }

  return strictest;
}
