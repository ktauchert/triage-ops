import { assertEncryptionConfigured } from "@gridnull/db";
import { assertProductionAuthConfig } from "@/lib/auth/environment";
import { assertAllowlistConfigured } from "@/lib/auth/setup";

function isNextBuild(): boolean {
  return process.env.npm_lifecycle_event === "build";
}

export function register() {
  if (isNextBuild()) {
    return;
  }

  assertProductionAuthConfig();
  assertEncryptionConfigured();
  assertAllowlistConfigured();
}
