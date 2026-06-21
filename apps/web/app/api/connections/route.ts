import { VcsProvider } from "@triage-ops/db";
import {
  createConnection,
  listConnections,
} from "@/lib/services/projects";
import {
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseJsonBody,
  requireString,
  requireVcsProvider,
} from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const connections = await listConnections(session);
  return jsonResponse({ connections });
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "connections.manage");
  if (denied) {
    return denied;
  }

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (isErrorResponse(body)) {
    return body;
  }

  const name = requireString(body.name, "name");
  if (isErrorResponse(name)) {
    return name;
  }

  const provider = requireVcsProvider(body.provider);
  if (isErrorResponse(provider)) {
    return provider;
  }

  const accessToken = requireString(body.accessToken, "accessToken");
  if (isErrorResponse(accessToken)) {
    return accessToken;
  }

  const baseUrl =
    typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined;

  if (provider === VcsProvider.GITLAB && !baseUrl) {
    return errorResponse("baseUrl is required for GitLab connections", 400);
  }

  const connection = await createConnection(session, {
    name,
    provider,
    baseUrl,
    accessToken,
  });
  return jsonResponse({ connection }, 201);
}
