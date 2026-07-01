import { isAllowlistConfigured } from "./allowlist";
import { isAuthDisabled } from "./config";

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDevAuthBypassAllowed(): boolean {
  if (!isAuthDisabled()) {
    return false;
  }

  if (!isProductionEnvironment()) {
    return true;
  }

  return process.env.ALLOW_AUTH_DISABLED === "true";
}

export function assertProductionAuthConfig(): void {
  if (isProductionEnvironment() && isAuthDisabled() && !isDevAuthBypassAllowed()) {
    throw new Error(
      "AUTH_DISABLED=true is not allowed in production. Set AUTH_DISABLED=false or use ALLOW_AUTH_DISABLED=true only for controlled CI.",
    );
  }

  if (isProductionEnvironment() && !isDevAuthBypassAllowed()) {
    const secret = process.env.AUTH_SECRET?.trim() ?? "";
    if (secret.length < 32) {
      const detail =
        secret.length === 0
          ? "AUTH_SECRET is missing from your .env file."
          : "AUTH_SECRET in your .env file is too short.";
      throw new Error(
        `${detail} Set it to a strong random value (at least 32 characters) in production. Generate one with: openssl rand -base64 32`,
      );
    }
  }
}

export function assertAllowlistConfigured(): void {
  if (
    !isProductionEnvironment() ||
    isDevAuthBypassAllowed() ||
    isAllowlistConfigured()
  ) {
    return;
  }

  throw new Error(
    "ALLOWED_EMAIL_DOMAINS or ALLOWED_EMAILS must be configured in production. " +
      "Set at least one allowlist to restrict who can sign in via OAuth.",
  );
}
