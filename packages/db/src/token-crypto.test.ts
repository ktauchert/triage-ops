import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEncryptionConfigured } from "./assert-encryption-configured.js";
import {
  isEncryptedAccessToken,
  openAccessToken,
  sealAccessToken,
} from "./token-crypto.js";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("token-crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes through plain tokens when encryption key is unset", () => {
    const token = "glpat-plain-token";
    expect(sealAccessToken(token)).toBe(token);
    expect(openAccessToken(token)).toBe(token);
    expect(isEncryptedAccessToken(token)).toBe(false);
  });

  it("encrypts and decrypts when TOKEN_ENCRYPTION_KEY is set", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);

    const sealed = sealAccessToken("ghp-secret");
    expect(isEncryptedAccessToken(sealed)).toBe(true);
    expect(sealed).not.toContain("ghp-secret");
    expect(openAccessToken(sealed)).toBe("ghp-secret");
  });

  it("reads legacy plain tokens when key is set", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    expect(openAccessToken("glpat-legacy")).toBe("glpat-legacy");
  });

  it("throws when decrypting without key", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    const sealed = sealAccessToken("ghp-secret");
    vi.unstubAllEnvs();

    expect(() => openAccessToken(sealed)).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  describe("assertEncryptionConfigured", () => {
    it("is a no-op outside production", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      expect(() => assertEncryptionConfigured()).not.toThrow();
    });

    it("throws in production when the key is missing", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      expect(() => assertEncryptionConfigured()).toThrow(/TOKEN_ENCRYPTION_KEY/);
    });

    it("passes in production when a valid key is set", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
      expect(() => assertEncryptionConfigured()).not.toThrow();
    });
  });
});
