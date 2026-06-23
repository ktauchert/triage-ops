import NextAuth from "next-auth";
import { nextAuthConfig } from "./auth.config";

export default NextAuth(nextAuthConfig).auth;

export const config = {
  matcher: [
    "/",
    "/connections",
    "/projects",
    "/setup",
    "/login",
    "/admin/:path*",
    "/api/connections/:path*",
    "/api/projects/:path*",
    "/api/admin/:path*",
  ],
};
