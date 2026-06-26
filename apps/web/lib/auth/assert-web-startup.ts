import { assertEncryptionConfigured } from "@triage-ops/db";
import { assertProductionAuthConfig } from "./environment";
import { assertAllowlistConfigured } from "./setup";

let asserted = false;

/** Fail fast in production when required `.env` values are missing or invalid. */
export function assertWebStartupConfig(): void {
  if (asserted) {
    return;
  }

  asserted = true;
  assertProductionAuthConfig();
  assertEncryptionConfigured();
  assertAllowlistConfigured();
}

assertWebStartupConfig();
