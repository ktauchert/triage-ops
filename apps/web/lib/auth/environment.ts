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
}
