import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRateLimitMaxForTier,
  getRateLimitTiersForPath,
  getRateLimitWindowSeconds,
  isRateLimitEnabled,
} from "./config";

describe("rate limit config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to disabled outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isRateLimitEnabled()).toBe(false);
  });

  it("defaults to enabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isRateLimitEnabled()).toBe(true);
  });

  it("respects explicit RATE_LIMIT_ENABLED override", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    expect(isRateLimitEnabled()).toBe(true);
  });

  it("parses custom window and tier limits", () => {
    vi.stubEnv("RATE_LIMIT_WINDOW_SECONDS", "120");
    vi.stubEnv("RATE_LIMIT_MAX_REQUESTS", "200");
    vi.stubEnv("RATE_LIMIT_SYNC_MAX", "3");

    expect(getRateLimitWindowSeconds()).toBe(120);
    expect(getRateLimitMaxForTier("default")).toBe(200);
    expect(getRateLimitMaxForTier("sync")).toBe(3);
  });

  it("classifies expensive API routes", () => {
    expect(
      getRateLimitTiersForPath("/api/projects/p1/sync", "POST"),
    ).toEqual(["default", "sync"]);
    expect(
      getRateLimitTiersForPath("/api/projects/p1/analyze", "POST"),
    ).toEqual(["default", "analyze"]);
    expect(
      getRateLimitTiersForPath(
        "/api/projects/p1/suggestions/s1",
        "PATCH",
      ),
    ).toEqual(["default", "apply"]);
    expect(getRateLimitTiersForPath("/api/admin/users", "GET")).toEqual([
      "default",
      "admin",
    ]);
    expect(getRateLimitTiersForPath("/api/auth/callback/gitlab", "GET")).toEqual(
      ["auth"],
    );
  });
});
