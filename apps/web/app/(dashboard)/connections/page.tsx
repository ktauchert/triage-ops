import { listConnections } from "@/lib/services/projects";
import { getAuthContext } from "@/lib/auth/session";
import { AddConnectionForm } from "./add-connection-form";
import { ConnectionsTable } from "./connections-table";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const authContext = await getAuthContext();
  const connections = await listConnections(authContext);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Connections</h2>
        <p className="text-muted-foreground">
          Register GitHub or GitLab access tokens for sync jobs.
        </p>
      </div>

      <AddConnectionForm />

      <ConnectionsTable connections={connections} />
    </div>
  );
}
