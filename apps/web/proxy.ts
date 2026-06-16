import NextAuth from "next-auth";
import { nextAuthConfig } from "./auth.config";

export default NextAuth(nextAuthConfig).auth;

export const config = {
  matcher: [
    "/",
    "/connections",
    "/projects",
    "/api/connections/:path*",
    "/api/projects/:path*",
  ],
};
