import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmailAllowed } from "./allowlist";

describe("isEmailAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows any email when allowlist is empty", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
    vi.stubEnv("ALLOWED_EMAILS", "");

    expect(isEmailAllowed("alice@company.com")).toBe(true);
  });

  it("allows emails on the explicit allowlist", () => {
    vi.stubEnv("ALLOWED_EMAILS", "alice@company.com, bob@company.com");
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");

    expect(isEmailAllowed("alice@company.com")).toBe(true);
    expect(isEmailAllowed("bob@company.com")).toBe(true);
    expect(isEmailAllowed("carol@company.com")).toBe(false);
  });

  it("allows emails matching allowed domains", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "company.com");
    vi.stubEnv("ALLOWED_EMAILS", "");

    expect(isEmailAllowed("alice@company.com")).toBe(true);
    expect(isEmailAllowed("alice@other.com")).toBe(false);
  });

  it("rejects missing email", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
    vi.stubEnv("ALLOWED_EMAILS", "");

    expect(isEmailAllowed(null)).toBe(false);
    expect(isEmailAllowed(undefined)).toBe(false);
    expect(isEmailAllowed("")).toBe(false);
  });
});
