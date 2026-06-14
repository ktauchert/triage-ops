import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

export function loadEnvFromMonorepoRoot(): void {
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
