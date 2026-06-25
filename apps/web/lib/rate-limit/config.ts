import { isProductionEnvironment } from "@/lib/auth/environment";

export type RateLimitTier =
  | "default"
  | "sync"
  | "analyze"
  | "apply"
  | "admin"
  | "auth";

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

export function isRateLimitEnabled(): boolean {
  return parseBoolean(
    process.env.RATE_LIMIT_ENABLED,
    isProductionEnvironment(),
  );
}

export function isRateLimitTrustProxy(): boolean {
  return parseBoolean(process.env.RATE_LIMIT_TRUST_PROXY, true);
}

export function getRateLimitWindowSeconds(): number {
  return parsePositiveInt(process.env.RATE_LIMIT_WINDOW_SECONDS, 60);
}

export function getRateLimitMaxForTier(tier: RateLimitTier): number {
  const defaults: Record<RateLimitTier, number> = {
    default: 120,
    sync: 10,
    analyze: 5,
    apply: 20,
    admin: 30,
    auth: 20,
  };

  const envKeys: Record<RateLimitTier, string | undefined> = {
    default: process.env.RATE_LIMIT_MAX_REQUESTS,
    sync: process.env.RATE_LIMIT_SYNC_MAX,
    analyze: process.env.RATE_LIMIT_ANALYZE_MAX,
    apply: process.env.RATE_LIMIT_APPLY_MAX,
    admin: process.env.RATE_LIMIT_ADMIN_MAX,
    auth: process.env.RATE_LIMIT_AUTH_MAX,
  };

  return parsePositiveInt(envKeys[tier], defaults[tier]);
}

export function getRateLimitTiersForPath(
  pathname: string,
  method: string,
): RateLimitTier[] {
  const tiers: RateLimitTier[] = ["default"];

  if (pathname.startsWith("/api/auth")) {
    return ["auth"];
  }

  if (pathname.startsWith("/api/admin")) {
    tiers.push("admin");
    return tiers;
  }

  const upperMethod = method.toUpperCase();

  if (upperMethod === "POST" && /\/sync\/?$/.test(pathname)) {
    tiers.push("sync");
  }

  if (upperMethod === "POST" && pathname.includes("/analyze")) {
    tiers.push("analyze");
  }

  if (upperMethod === "PATCH" && /\/suggestions\/[^/]+\/?$/.test(pathname)) {
    tiers.push("apply");
  }

  return tiers;
}
