"use server";

import { signIn } from "@/auth";
import type { AuthProvider } from "@/lib/auth/config";

export async function signInFromSetup(formData: FormData) {
  if (formData.get("termsAccepted") !== "true") {
    throw new Error("You must accept the EULA and Privacy Policy to continue.");
  }

  const provider = formData.get("provider");
  if (provider !== "github" && provider !== "gitlab") {
    throw new Error("Invalid sign-in provider.");
  }

  await signIn(provider satisfies AuthProvider, {
    redirectTo: "/",
  });
}
