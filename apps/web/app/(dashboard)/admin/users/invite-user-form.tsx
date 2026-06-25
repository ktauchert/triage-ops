"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { USER_ROLES, type AppUserRole } from "@/lib/auth/roles";
import { formatUserRole, getInviteRoleCapabilityLabels } from "@/lib/auth/role-display";
import { RoleCapabilityChips } from "@/components/home/role-capability-chips";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readResponseJson } from "@/lib/fetch-json";

export function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppUserRole>("VIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const capabilityLabels = getInviteRoleCapabilityLabels(role);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await readResponseJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to invite user");
      }

      setEmail("");
      setRole("VIEWER");
      setSuccessMessage(
        "Invite sent — the user can sign in with OAuth after you share the app URL.",
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to invite user",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite user</CardTitle>
        <CardDescription>
          Closed registration: pre-provision an email and role before the user
          signs in with GitHub or GitLab OAuth.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
          <div className="grid gap-2">
            <Label htmlFor="inviteEmail">Email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@company.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inviteRole">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as AppUserRole)}
            >
              <SelectTrigger id="inviteRole" className="w-full max-w-xs">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {formatUserRole(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RoleCapabilityChips labels={capabilityLabels} />
          </div>
          {successMessage ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              {successMessage}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Inviting…" : "Invite user"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
