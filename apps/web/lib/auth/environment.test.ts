import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
});
