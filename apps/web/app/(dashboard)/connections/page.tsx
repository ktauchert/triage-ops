import { redirect } from "next/navigation";
import { listConnections } from "@/lib/services/projects";
import { getAuthContext } from "@/lib/auth/session";
import { getRoleCapabilities } from "@/lib/auth/permissions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddConnectionForm } from "./add-connection-form";
import { ConnectionsTable } from "./connections-table";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const authContext = await getAuthContext();
  const { canManageConnections } = getRoleCapabilities(authContext.role);

  if (!canManageConnections) {
    redirect("/");
  }

  const connections = await listConnections(authContext);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Connections" },
        ]}
      />

      <div>
        <h2 className="page-heading">Connections</h2>
        <p className="page-subheading">
          Register GitHub or GitLab access tokens for sync jobs.
        </p>
      </div>

      {canManageConnections ? <AddConnectionForm /> : null}

      <ConnectionsTable
        connections={connections}
        canManage={canManageConnections}
      />
    </div>
  );
}
