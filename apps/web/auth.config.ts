import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import GitLab from "next-auth/providers/gitlab";
import { UserRole, prisma } from "@triage-ops/db";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import {
  authConfig,
  getConfiguredProviders,
  isAdminEmail,
  isAuthDisabled,
  type AuthProvider,
} from "@/lib/auth/config";

function buildProviders() {
  const configured = new Set<AuthProvider>(getConfiguredProviders());
  const providers = [];

  if (configured.has("github")) {
    providers.push(
      GitHub({
        clientId: authConfig.github.clientId,
        clientSecret: authConfig.github.clientSecret,
      }),
    );
  }

  if (configured.has("gitlab")) {
    providers.push(
      GitLab({
        clientId: authConfig.gitlab.clientId,
        clientSecret: authConfig.gitlab.clientSecret,
        issuer: authConfig.gitlab.issuer,
      }),
    );
  }

  return providers;
}

export const nextAuthConfig = {
  secret: authConfig.secret,
  trustHost: true,
  providers: buildProviders(),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (isAuthDisabled()) {
        return true;
      }

      if (!isEmailAllowed(user.email)) {
        return false;
      }

      if (user.id && isAdminEmail(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: UserRole.ADMIN },
        });
      }

      return true;
    },
    authorized({ auth: session, request }) {
      if (isAuthDisabled()) {
        return true;
      }

      const { pathname } = request.nextUrl;

      if (pathname === "/login" || pathname.startsWith("/api/auth")) {
        return true;
      }

      return Boolean(session?.user);
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
