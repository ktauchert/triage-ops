import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw-server.js";

process.env.VCS_HTTP_RETRY_BASE_MS = "0";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
