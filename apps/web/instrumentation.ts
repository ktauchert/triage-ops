import { assertProductionAuthConfig } from "@/lib/auth/environment";

export async function register() {
  assertProductionAuthConfig();
}
