import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getEncryptionKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    return null;
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded). Generate with: openssl rand -base64 32",
    );
  }

  return key;
}

export function isEncryptedAccessToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Fail fast in production when at-rest encryption is not configured.
 * Without a key, `sealAccessToken` silently stores VCS PATs in plain text.
 * Calling `getEncryptionKey()` also validates the key length when present.
 */
export function assertEncryptionConfigured(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required in production to encrypt VCS tokens at rest. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
}

export function sealAccessToken(plain: string): string {
  const key = getEncryptionKey();
  if (!key) {
    return plain;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function openAccessToken(stored: string): string {
  if (!isEncryptedAccessToken(stored)) {
    return stored;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required to decrypt stored VCS tokens",
    );
  }

  const payload = stored.slice(PREFIX.length);
  const [ivPart, cipherPart, tagPart] = payload.split(".");
  if (!ivPart || !cipherPart || !tagPart) {
    throw new Error("Invalid encrypted access token format");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const encrypted = Buffer.from(cipherPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");

  if (tag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted access token tag");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
