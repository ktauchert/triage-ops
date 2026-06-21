import { expect, vi } from "vitest";
import { USER_ROLES } from "@/lib/auth/roles";
import type { AuthContext } from "@/lib/auth/session";

export const ALL_ROLES = USER_ROLES;

export const testAuthContext: AuthContext = {
  userId: "user-test",
  role: "ADMIN",
  dataScope: "shared",
  email: "test@example.com",
  name: "Test User",
};

export function testAuthContextWithRole(
  role: AuthContext["role"],
): AuthContext {
  return { ...testAuthContext, role };
}

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

export async function expectForbidden(response: Response): Promise<void> {
  expect(response.status).toBe(403);
  const data = await response.json();
  expect(data).toEqual({ error: "Forbidden" });
}
