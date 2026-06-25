import { assertEncryptionConfigured } from "@triage-ops/db";
import { assertProductionAuthConfig } from "@/lib/auth/environment";
import { assertAllowlistConfigured } from "@/lib/auth/setup";

export async function register() {
  assertProductionAuthConfig();
  assertEncryptionConfigured();
  assertAllowlistConfigured();
}
