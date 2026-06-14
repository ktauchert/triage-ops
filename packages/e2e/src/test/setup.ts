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

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
