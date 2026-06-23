import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../../../../apps/worker/src/test/msw-server.js";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

config({ path: path.join(rootDir, ".env") });

// E2E runs an in-process BullMQ worker with MSW-mocked GitHub. A running
// dev:worker on the same Redis DB steals jobs and hits real GitHub → 401.
// Use a dedicated Redis DB unless E2E_REDIS_URL is set explicitly.
if (process.env.E2E_REDIS_URL) {
  process.env.REDIS_URL = process.env.E2E_REDIS_URL;
} else {
  const base = process.env.REDIS_URL ?? "redis://localhost:6379";
  const url = new URL(base);
  url.pathname = "/15";
  process.env.REDIS_URL = url.toString();
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
