"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

type ProjectOption = {
  id: string;
  name: string;
  pathWithNamespace: string;
  isFavorite: boolean;
};

export function ProjectSelector({
  projects,
  selectedProjectId,
}: {
  projects: ProjectOption[];
  selectedProjectId: string | null;
}) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No projects yet. Add a connection and project first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="project-select" className="text-sm font-medium">
        Project
      </label>
      <select
        id="project-select"
        value={selectedProjectId ?? ""}
        onChange={(event) => {
          const projectId = event.target.value;
          router.push(projectId ? `/?project=${projectId}` : "/");
        }}
        className="h-10 max-w-md rounded-md border border-input bg-background px-3 text-sm"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.isFavorite ? "★ " : ""}
            {project.name} ({project.pathWithNamespace})
          </option>
        ))}
      </select>
      {projects.some((project) => project.isFavorite) ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
          Favorites load first on the dashboard.
        </p>
      ) : null}
    </div>
  );
}
