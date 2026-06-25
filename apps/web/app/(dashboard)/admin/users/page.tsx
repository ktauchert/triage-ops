import { listPendingInvites, listUsers } from "@/lib/services/admin";
import { getAuthContext } from "@/lib/auth/session";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AdminUsersTable } from "./admin-users-table";
import { InviteUserForm } from "./invite-user-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const authContext = await getAuthContext();
  const [users, pendingInvites] = await Promise.all([
    listUsers(),
    listPendingInvites(),
  ]);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Users" },
        ]}
      />

      <div>
        <h2 className="page-heading">Users</h2>
        <p className="page-subheading">
          Invite colleagues by email, assign roles, and control who can sign in
          after instance setup.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="section-heading">Invite user</h3>
        <InviteUserForm />
      </div>

      <AdminUsersTable
        users={users}
        pendingInvites={pendingInvites}
        currentUserId={authContext.userId}
      />
    </div>
  );
}
