"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { USER_ROLES, type AppUserRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readResponseJson } from "@/lib/fetch-json";

export function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppUserRole>("VIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

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
        <select
          id="inviteRole"
          className="select-field"
          value={role}
          onChange={(event) => setRole(event.target.value as AppUserRole)}
        >
          {USER_ROLES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Inviting…" : "Invite user"}
      </Button>
    </form>
  );
}
