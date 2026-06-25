import { listAuditEvents } from "@/lib/services/audit";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Audit log" },
        ]}
      />

      <div>
        <h2 className="page-heading">Audit log</h2>
        <p className="page-subheading">
          Who did what in TriageOps — applies, syncs, connection changes, and
          role updates.
        </p>
      </div>

      <AdminAuditTable initialEvents={serialized} />
    </div>
  );
}
