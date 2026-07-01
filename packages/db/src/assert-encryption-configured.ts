function decodeEncryptionKey(raw: string): Uint8Array | null {
  try {
    const binary = atob(raw);
    if (binary.length !== 32) {
      return null;
    }

    const key = new Uint8Array(32);
    for (let index = 0; index < 32; index += 1) {
      key[index] = binary.charCodeAt(index);
    }

    return key;
  } catch {
    return null;
  }
}

/**
 * Fail fast in production when at-rest encryption is not configured.
 * Edge-safe (no node:crypto) — used by Next.js instrumentation.
 */
export function assertEncryptionConfigured(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required in production to encrypt VCS tokens at rest. " +
        "Generate one with: openssl rand -base64 32",
    );
  }

  if (!decodeEncryptionKey(raw)) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded). Generate with: openssl rand -base64 32",
    );
  }
}
