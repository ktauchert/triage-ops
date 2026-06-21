"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { USER_ROLES, type AppUserRole } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
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
};

export function AdminUsersTable({ users }: { users: UserRow[] }) {
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

  return (
    <>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name ?? "—"}</TableCell>
                    <TableCell>{user.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-md border bg-background px-2 py-1 text-sm"
                          value={user.role}
                          disabled={busyId === user.id}
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
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
