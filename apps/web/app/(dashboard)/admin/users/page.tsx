import Link from "next/link";
import { listUsers } from "@/lib/services/admin";
import { AdminUsersTable } from "./admin-users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await listUsers();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-heading">Users</h2>
          <p className="page-subheading">
            Assign roles to control who can sync, analyze, apply suggestions, and
            manage connections.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className="text-sm font-medium text-primary hover:underline"
        >
          View audit log
        </Link>
      </div>

      <AdminUsersTable users={users} />
    </div>
  );
}
