import { assertEncryptionConfigured } from "@gridnull/db/assert-encryption-configured";
import {
  assertAllowlistConfigured,
  assertProductionAuthConfig,
} from "@/lib/auth/environment";

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
