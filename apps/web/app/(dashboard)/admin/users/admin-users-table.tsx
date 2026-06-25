"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { USER_ROLES, type AppUserRole } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readResponseJson } from "@/lib/fetch-json";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: AppUserRole;
  deactivatedAt: Date | string | null;
};

type PendingInviteRow = {
  id: string;
  email: string;
  role: AppUserRole;
  invitedAt: Date;
};

export function AdminUsersTable({
  users,
  pendingInvites,
  currentUserId,
}: {
  users: UserRow[];
  pendingInvites: PendingInviteRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: AppUserRole) {
    setBusyId(userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await readResponseJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to update role");
      }

      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update role",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(userId: string, deactivated: boolean) {
    const action = deactivated ? "deactivate" : "reactivate";
    if (
      !window.confirm(
        deactivated
          ? "Deactivate this user? They will be signed out and cannot sign in again until reactivated."
          : "Reactivate this user? They will be able to sign in again.",
      )
    ) {
      return;
    }

    setBusyId(userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deactivated }),
      });
      const data = await readResponseJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error ?? `Failed to ${action} user`);
      }

      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : `Failed to ${action} user`,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(userId: string, email: string | null) {
    if (
      !window.confirm(
        `Delete user ${email ?? userId}? This removes their account and sign-in access.`,
      )
    ) {
      return;
    }

    setBusyId(userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to delete user");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete user",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelInvite(inviteId: string, email: string) {
    if (!window.confirm(`Cancel invite for ${email}?`)) {
      return;
    }

    setBusyId(inviteId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/invites/${inviteId}`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to cancel invite");
      }

      router.refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Failed to cancel invite",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending invites. Invited users can sign in once with OAuth.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invite.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invite.invitedAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === invite.id}
                        onClick={() =>
                          void handleCancelInvite(invite.id, invite.email)
                        }
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isDeactivated = Boolean(user.deactivatedAt);
                  const rowBusy = busyId === user.id;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.name ?? "—"}</TableCell>
                      <TableCell>{user.email ?? "—"}</TableCell>
                      <TableCell>
                        <select
                          className="rounded-md border bg-background px-2 py-1 text-sm"
                          value={user.role}
                          disabled={rowBusy || isSelf || isDeactivated}
                          onChange={(event) =>
                            void handleRoleChange(
                              user.id,
                              event.target.value as AppUserRole,
                            )
                          }
                        >
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant="secondary">You</Badge>
                        ) : isDeactivated ? (
                          <Badge variant="destructive">Deactivated</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!isSelf ? (
                            isDeactivated ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={rowBusy}
                                onClick={() =>
                                  void handleDeactivate(user.id, false)
                                }
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={rowBusy}
                                onClick={() =>
                                  void handleDeactivate(user.id, true)
                                }
                              >
                                Deactivate
                              </Button>
                            )
                          ) : null}
                          {!isSelf ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={rowBusy}
                              onClick={() =>
                                void handleDelete(user.id, user.email)
                              }
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
