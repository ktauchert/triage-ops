import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.join(__dirname, "../..");
loadEnvConfig(monorepoRoot);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@triage-ops/db", "@triage-ops/metrics"],
};

export default nextConfig;
