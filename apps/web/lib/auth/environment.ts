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
      throw new Error(
        "AUTH_SECRET must be set to a strong random value (>= 32 chars) in production. Generate one with: openssl rand -base64 32",
      );
    }
  }
}
