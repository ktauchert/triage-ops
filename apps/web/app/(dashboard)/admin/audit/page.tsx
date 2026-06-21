import Link from "next/link";
import { listAuditEvents } from "@/lib/services/audit";
import { AdminAuditTable } from "./admin-audit-table";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const events = await listAuditEvents({ limit: 200 });

  const serialized = events.map((event) => ({
    id: event.id,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
    user: event.user
      ? {
          email: event.user.email,
          name: event.user.name,
        }
      : null,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-heading">Audit log</h2>
          <p className="page-subheading">
            Who did what in TriageOps — applies, syncs, connection changes, and
            role updates.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage users
        </Link>
      </div>

      <AdminAuditTable initialEvents={serialized} />
    </div>
  );
}
