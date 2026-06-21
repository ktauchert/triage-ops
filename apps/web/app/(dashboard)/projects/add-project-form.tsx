"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  isFavorite: boolean;
};

type RemoteProject = {
  externalProjectId: number | null;
  pathWithNamespace: string;
  name: string;
};

export function AddProjectForm({
  connections,
}: {
  connections: ConnectionOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [remoteProjects, setRemoteProjects] = useState<RemoteProject[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectKey, setSelectedProjectKey] = useState("");
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

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) {
      return remoteProjects;
    }

    return remoteProjects.filter(
      (project) =>
        project.pathWithNamespace.toLowerCase().includes(query) ||
        project.name.toLowerCase().includes(query),
    );
  }, [projectSearch, remoteProjects]);

  function resetProjectList() {
    setRemoteProjects([]);
    setListError(null);
    setSelectedProjectKey("");
  }

  useEffect(() => {
    if (!form.connectionId || manualEntry) {
      return;
    }

    let cancelled = false;

    async function loadProjects() {
      setLoadingProjects(true);
      setListError(null);
      setRemoteProjects([]);
      setSelectedProjectKey("");

      try {
        const response = await fetch(
          `/api/connections/${form.connectionId}/remote-projects`,
        );
        const data = (await response.json()) as {
          error?: string;
          projects?: RemoteProject[];
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load projects");
        }

        if (!cancelled) {
          setRemoteProjects(data.projects ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setListError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load projects",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProjects(false);
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [form.connectionId, manualEntry]);

  function handleProjectSelect(projectKey: string) {
    setSelectedProjectKey(projectKey);

    const project = remoteProjects.find(
      (entry) =>
        `${entry.pathWithNamespace}:${entry.externalProjectId ?? ""}` ===
        projectKey,
    );

    if (!project) {
      return;
    }

    setForm((current) => ({
      ...current,
      pathWithNamespace: project.pathWithNamespace,
      name: project.name,
      externalProjectId: project.externalProjectId
        ? String(project.externalProjectId)
        : "",
    }));
  }

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
      setSelectedProjectKey("");
      setProjectSearch("");
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
            Pick a repository or project from your connection token, or enter
            details manually.
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
                  onChange={(event) => {
                    resetProjectList();
                    setForm((current) => ({
                      ...current,
                      connectionId: event.target.value,
                    }));
                  }}
                  className="select-field"
                  required
                >
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.isFavorite ? "★ " : ""}
                      {connection.name} ({connection.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {manualEntry
                    ? "Enter project details manually."
                    : "Load repositories from the connection token."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualEntry((current) => {
                      if (!current) {
                        resetProjectList();
                      }
                      return !current;
                    });
                  }}
                >
                  {manualEntry ? "Use project list" : "Enter manually"}
                </Button>
              </div>

              {!manualEntry ? (
                <div className="grid gap-2">
                  <Label htmlFor="projectSearch">
                    {isGitHub ? "Repository" : "Project"}
                  </Label>
                  {loadingProjects ? (
                    <p className="text-sm text-muted-foreground">
                      Loading {isGitHub ? "repositories" : "projects"}...
                    </p>
                  ) : listError ? (
                    <p className="text-sm text-destructive">{listError}</p>
                  ) : remoteProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No {isGitHub ? "repositories" : "projects"} found for this
                      token.
                    </p>
                  ) : (
                    <>
                      <Input
                        id="projectSearch"
                        value={projectSearch}
                        onChange={(event) => setProjectSearch(event.target.value)}
                        placeholder="Filter by name or path..."
                      />
                      <select
                        value={selectedProjectKey}
                        onChange={(event) =>
                          handleProjectSelect(event.target.value)
                        }
                        className="select-field"
                        required
                      >
                        <option value="">Select a project...</option>
                        {filteredProjects.map((project) => {
                          const key = `${project.pathWithNamespace}:${project.externalProjectId ?? ""}`;
                          return (
                            <option key={key} value={key}>
                              {project.pathWithNamespace}
                              {project.name !== project.pathWithNamespace
                                ? ` — ${project.name}`
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                    </>
                  )}
                </div>
              ) : (
                <>
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
                      placeholder={
                        isGitHub ? "octocat/Hello-World" : "group/my-project"
                      }
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
                </>
              )}

              {!manualEntry && selectedProjectKey ? (
                <div className="glass-subtle rounded-lg border px-4 py-3 text-sm">
                  <p className="font-medium">{form.name || "Selected project"}</p>
                  <p className="text-muted-foreground">
                    {form.pathWithNamespace}
                    {!isGitHub && form.externalProjectId
                      ? ` · ID ${form.externalProjectId}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={
                  submitting ||
                  (!manualEntry &&
                    (loadingProjects || !selectedProjectKey || Boolean(listError)))
                }
              >
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
