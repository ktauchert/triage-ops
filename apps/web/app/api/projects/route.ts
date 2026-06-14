import { VcsProvider } from "@triage-ops/db";
import {
  createProject,
  listProjects,
} from "@/lib/services/projects";
import {
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseJsonBody,
  requireOptionalPositiveInt,
  requireString,
} from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { prisma } from "@triage-ops/db";
import { canAccessConnection } from "@/lib/auth/access";

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const projects = await listProjects(session);
  return jsonResponse({ projects });
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (isErrorResponse(body)) {
    return body;
  }

  const connectionId = requireString(body.connectionId, "connectionId");
  if (isErrorResponse(connectionId)) {
    return connectionId;
  }

  const pathWithNamespace = requireString(
    body.pathWithNamespace,
    "pathWithNamespace",
  );
  if (isErrorResponse(pathWithNamespace)) {
    return pathWithNamespace;
  }

  const name = requireString(body.name, "name");
  if (isErrorResponse(name)) {
    return name;
  }

  const connection = await prisma.vcsConnection.findUnique({
    where: { id: connectionId },
    select: { provider: true, userId: true },
  });

  if (!connection || !canAccessConnection(session, connection.userId)) {
    return errorResponse("Connection not found", 404);
  }

  let externalProjectId: number | undefined;

  if (connection.provider === VcsProvider.GITLAB) {
    const parsedId = requireOptionalPositiveInt(
      body.externalProjectId ?? body.gitlabProjectId,
      "externalProjectId",
      { required: true },
    );
    if (isErrorResponse(parsedId)) {
      return parsedId;
    }
    externalProjectId = parsedId;
  } else if (
    body.externalProjectId !== undefined ||
    body.gitlabProjectId !== undefined
  ) {
    return errorResponse(
      "externalProjectId is not used for GitHub projects",
      400,
    );
  }

  try {
    const project = await createProject(session, {
      connectionId,
      externalProjectId,
      pathWithNamespace,
      name,
    });

    if (!project) {
      return errorResponse("Connection not found", 404);
    }

    return jsonResponse({ project }, 201);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create project",
      400,
    );
  }
}
