import { jsonResponse } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/services/admin";

export async function GET() {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const denied = requirePermission(session, "admin.users");
  if (denied) {
    return denied;
  }

  const users = await listUsers();
  return jsonResponse({ users });
}
