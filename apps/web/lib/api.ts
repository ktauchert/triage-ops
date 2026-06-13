export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function parseJsonBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<T | Response> {
  try {
    return (await request.json()) as T;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
}

export function requireString(
  value: unknown,
  field: string,
): string | Response {
  if (typeof value !== "string" || value.trim().length === 0) {
    return errorResponse(`${field} is required`, 400);
  }

  return value.trim();
}

export function requirePositiveInt(
  value: unknown,
  field: string,
): number | Response {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return errorResponse(`${field} must be a positive integer`, 400);
  }

  return value;
}

export function requireOptionalPositiveInt(
  value: unknown,
  field: string,
  options: { required?: boolean } = {},
): number | undefined | Response {
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      return errorResponse(`${field} is required`, 400);
    }
    return undefined;
  }

  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return errorResponse(`${field} must be a positive integer`, 400);
  }

  return parsed;
}

import { VcsProvider } from "@triage-ops/db";

export function requireVcsProvider(value: unknown): VcsProvider | Response {
  if (value === VcsProvider.GITLAB || value === VcsProvider.GITHUB) {
    return value;
  }

  return errorResponse("provider must be GITLAB or GITHUB", 400);
}

export function isErrorResponse(value: unknown): value is Response {
  return value instanceof Response;
}
