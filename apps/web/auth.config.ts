import "@/lib/auth/assert-web-startup";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import GitLab from "next-auth/providers/gitlab";
import { isDevAuthBypassAllowed } from "@/lib/auth/environment";
import {
  authConfig,
  getConfiguredProviders,
  isAuthDisabled,
  type AuthProvider,
} from "@/lib/auth/config";
import {
  applySignInUserState,
  canSignInWithEmail,
  isSetupComplete,
} from "@/lib/auth/setup";

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
  events: {
    async signIn({ user }) {
      if (isAuthDisabled() || !user.id) {
        return;
      }

      await applySignInUserState(user.id, user.email);
    },
  },
  callbacks: {
    async signIn({ user }) {
      if (isAuthDisabled()) {
        return isDevAuthBypassAllowed();
      }

      return canSignInWithEmail(user.email);
    },
    async authorized({ auth: session, request }) {
      if (isAuthDisabled()) {
        return isDevAuthBypassAllowed();
      }

      const { pathname } = request.nextUrl;
      const isApiRoute =
        pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

      if (
        pathname === "/login" ||
        pathname === "/setup" ||
        pathname.startsWith("/api/auth")
      ) {
        return true;
      }

      if (!(await isSetupComplete())) {
        if (isApiRoute) {
          return Response.json(
            { error: "Instance setup is not complete" },
            { status: 503 },
          );
        }

        return Response.redirect(new URL("/setup", request.nextUrl));
      }

      if (!session?.user) {
        if (isApiRoute) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        return false;
      }

      return true;
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
