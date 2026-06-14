import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFromMonorepoRoot(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  let dir = process.cwd();

  for (let depth = 0; depth < 6; depth += 1) {
    const envPath = path.join(dir, ".env");

    if (existsSync(envPath)) {
      config({ path: envPath, override: false });

      if (process.env.DATABASE_URL) {
        return;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
}

loadEnvFromMonorepoRoot();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
