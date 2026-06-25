import { isRateLimitTrustProxy } from "./config";

export function getClientIp(request: Request): string {
  if (isRateLimitTrustProxy()) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }
  }

  return "unknown";
}

export function buildRateLimitIdentifier(options: {
  userId?: string;
  ip: string;
}): string {
  if (options.userId) {
    return `user:${options.userId}`;
  }

  return `ip:${options.ip}`;
}
