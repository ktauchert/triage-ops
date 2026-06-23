"use server";

import { signOut } from "@/auth";

export async function signOutTo(redirectTo: string) {
  await signOut({ redirectTo });
}
