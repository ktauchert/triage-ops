import { errorResponse } from "@/lib/api";
import {
  getRateLimitTiersForPath,
  isRateLimitEnabled,
  type RateLimitTier,
} from "./config";
import { buildRateLimitIdentifier, getClientIp } from "./client-key";
import { consumeRateLimitTiers, type RateLimitResult } from "./redis-window";

function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(result.resetAt - Math.floor(Date.now() / 1000), 1);
  const response = errorResponse("Too many requests. Try again later.", 429);
  response.headers.set("Retry-After", String(retryAfter));
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetAt));
  return response;
}

export async function enforceRateLimit(
  request: Request,
  options: { userId?: string } = {},
): Promise<Response | null> {
  if (!isRateLimitEnabled()) {
    return null;
  }

  const url = new URL(request.url);
  const tiers = getRateLimitTiersForPath(url.pathname, request.method);
  const identifier = buildRateLimitIdentifier({
    userId: options.userId,
    ip: getClientIp(request),
  });

  try {
    const result = await consumeRateLimitTiers(tiers, identifier);
    if (result && !result.allowed) {
      return rateLimitResponse(result);
    }

    return null;
  } catch (error) {
    console.warn(
      "[rate-limit] Redis unavailable; allowing request:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function enforceApiRateLimit(
  request: Request,
  userId: string,
): Promise<Response | null> {
  return enforceRateLimit(request, { userId });
}

export async function enforceAuthRateLimit(
  request: Request,
): Promise<Response | null> {
  if (!isRateLimitEnabled()) {
    return null;
  }

  const tiers: RateLimitTier[] = ["auth"];
  const identifier = buildRateLimitIdentifier({
    ip: getClientIp(request),
  });

  try {
    const result = await consumeRateLimitTiers(tiers, identifier);
    if (result && !result.allowed) {
      return rateLimitResponse(result);
    }

    return null;
  } catch (error) {
    console.warn(
      "[rate-limit] Redis unavailable; allowing auth request:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
