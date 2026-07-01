import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertAllowlistConfigured,
  assertProductionAuthConfig,
  isDevAuthBypassAllowed,
  isProductionEnvironment,
} from "./environment";

describe("environment auth guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats NODE_ENV=production as production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProductionEnvironment()).toBe(true);
  });

  it("allows dev auth bypass outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(isDevAuthBypassAllowed()).toBe(true);
  });

  it("blocks dev auth bypass in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(isDevAuthBypassAllowed()).toBe(false);
  });

  it("allows explicit CI override in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "true");
    vi.stubEnv("ALLOW_AUTH_DISABLED", "true");
    expect(isDevAuthBypassAllowed()).toBe(true);
  });

  it("throws when auth is disabled in production without override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(() => assertProductionAuthConfig()).toThrow(/AUTH_DISABLED/);
  });

  it("throws when AUTH_SECRET is missing in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => assertProductionAuthConfig()).toThrow(
      /AUTH_SECRET is missing from your \.env file/,
    );
  });

  it("throws when AUTH_SECRET is too short in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_SECRET", "too-short");
    expect(() => assertProductionAuthConfig()).toThrow(
      /AUTH_SECRET in your \.env file is too short/,
    );
  });

  it("passes in production with a strong AUTH_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_SECRET", "a".repeat(32));
    expect(() => assertProductionAuthConfig()).not.toThrow();
  });
});

describe("assertAllowlistConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertAllowlistConfigured()).not.toThrow();
  });

  it("throws in production when the allowlist is empty", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(() => assertAllowlistConfigured()).toThrow(/ALLOWED_EMAIL/);
  });

  it("passes in production when an allowlist is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "company.com");
    expect(() => assertAllowlistConfigured()).not.toThrow();
  });
});
