import NextAuth from "next-auth";
import { nextAuthConfig } from "./auth.config";

export default NextAuth(nextAuthConfig).auth;

export const config = {
  matcher: [
    "/",
    "/project/:path*",
    "/connections",
    "/projects",
    "/setup",
    "/login",
    "/admin",
    "/admin/:path*",
    "/api/connections/:path*",
    "/api/projects/:path*",
    "/api/admin/:path*",
  ],
};
