import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@triage-ops/db";
import NextAuth from "next-auth";
import { nextAuthConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...nextAuthConfig,
  adapter: PrismaAdapter(prisma),
});
