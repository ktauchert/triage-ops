"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
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

type ConnectionOption = {
  id: string;
  name: string;
  provider: "GITLAB" | "GITHUB";
};

export function AddProjectForm({
  connections,
}: {
  connections: ConnectionOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    connectionId: connections[0]?.id ?? "",
    externalProjectId: "",
    pathWithNamespace: "",
    name: "",
  });

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === form.connectionId),
    [connections, form.connectionId],
  );

  const isGitHub = selectedConnection?.provider === "GITHUB";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        connectionId: form.connectionId,
        pathWithNamespace: form.pathWithNamespace,
        name: form.name,
      };

      if (!isGitHub) {
        payload.externalProjectId = Number.parseInt(
          form.externalProjectId,
          10,
        );
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create project");
      }

      setForm((current) => ({
        ...current,
        externalProjectId: "",
        pathWithNamespace: "",
        name: "",
      }));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create project",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add project</CardTitle>
          <CardDescription>
            {isGitHub
              ? "Use owner/repo (e.g. octocat/Hello-World)."
              : "Use the numeric GitLab project ID and path with namespace."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a connection before registering projects.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
              <div className="grid gap-2">
                <Label htmlFor="connectionId">Connection</Label>
                <select
                  id="connectionId"
                  value={form.connectionId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      connectionId: event.target.value,
                    }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} ({connection.provider})
                    </option>
                  ))}
                </select>
              </div>
              {!isGitHub ? (
                <div className="grid gap-2">
                  <Label htmlFor="externalProjectId">GitLab project ID</Label>
                  <Input
                    id="externalProjectId"
                    value={form.externalProjectId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        externalProjectId: event.target.value,
                      }))
                    }
                    placeholder="12345678"
                    required
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="pathWithNamespace">
                  {isGitHub ? "Repository (owner/repo)" : "Path with namespace"}
                </Label>
                <Input
                  id="pathWithNamespace"
                  value={form.pathWithNamespace}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pathWithNamespace: event.target.value,
                    }))
                  }
                  placeholder={isGitHub ? "octocat/Hello-World" : "group/my-project"}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="My Project"
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save project"}
              </Button>
            </form>
          )}
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
