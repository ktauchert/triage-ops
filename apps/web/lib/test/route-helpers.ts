import { expect, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

export const testAuthContext: AuthContext = {
  userId: "user-test",
  dataScope: "shared",
  email: "test@example.com",
  name: "Test User",
};

export function jsonRequest(
  method: string,
  url: string,
  body?: unknown,
): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export async function readJson<T>(
  response: Response,
  expectedStatus: number,
): Promise<T> {
  expect(response.status).toBe(expectedStatus);
  return (await response.json()) as T;
}

export function mockAuthSession(
  session: AuthContext = testAuthContext,
): void {
  vi.doMock("@/lib/auth/session", () => ({
    requireApiSession: vi.fn().mockResolvedValue(session),
  }));
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
