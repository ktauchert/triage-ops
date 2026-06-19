"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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

type Provider = "GITLAB" | "GITHUB";

export function AddConnectionForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("GITHUB");
  const [form, setForm] = useState({
    name: "",
    baseUrl: "https://gitlab.com",
    accessToken: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          provider,
          baseUrl: provider === "GITLAB" ? form.baseUrl : undefined,
          accessToken: form.accessToken,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create connection");
      }

      setForm({ name: "", baseUrl: "https://gitlab.com", accessToken: "" });
      setProvider("GITHUB");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create connection",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add connection</CardTitle>
          <CardDescription>
            Connect GitHub or GitLab with a personal access token. Tokens are
            stored in Postgres for MVP. GitHub needs the{" "}
            <code className="text-xs">repo</code> scope (or{" "}
            <code className="text-xs">public_repo</code> for public repos).
            GitLab needs <code className="text-xs">read_api</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as Provider)
                }
                className="select-field"
              >
                <option value="GITHUB">GitHub</option>
                <option value="GITLAB">GitLab</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={provider === "GITHUB" ? "My GitHub" : "My GitLab"}
                required
              />
            </div>
            {provider === "GITLAB" ? (
              <div className="grid gap-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={form.baseUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))
                  }
                  placeholder="https://gitlab.com"
                  required
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="accessToken">Access token</Label>
              <Input
                id="accessToken"
                type="password"
                value={form.accessToken}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accessToken: event.target.value,
                  }))
                }
                placeholder={
                  provider === "GITHUB" ? "ghp_..." : "glpat-..."
                }
                required
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save connection"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
