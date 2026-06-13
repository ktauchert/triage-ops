import { Redis } from "ioredis";
import { getEnv } from "../config/env.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(getEnv("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
