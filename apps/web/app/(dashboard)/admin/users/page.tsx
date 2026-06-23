import Link from "next/link";
import { listPendingInvites, listUsers } from "@/lib/services/admin";
import { AdminUsersTable } from "./admin-users-table";
import { InviteUserForm } from "./invite-user-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, pendingInvites] = await Promise.all([
    listUsers(),
    listPendingInvites(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-heading">Users</h2>
          <p className="page-subheading">
            Invite colleagues by email, assign roles, and control who can sign in
            after instance setup.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className="text-sm font-medium text-primary hover:underline"
        >
          View audit log
        </Link>
      </div>

      <div className="space-y-3">
        <h3 className="section-heading">Invite user</h3>
        <InviteUserForm />
      </div>

      <AdminUsersTable users={users} pendingInvites={pendingInvites} />
    </div>
  );
}
