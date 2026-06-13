import { listConnections, listProjects } from "@/lib/services/projects";
import { AddProjectForm } from "./add-project-form";
import { ProjectsTable } from "./projects-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, connections] = await Promise.all([
    listProjects(),
    listConnections(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Projects</h2>
        <p className="text-muted-foreground">
          Register GitHub or GitLab repositories and trigger background sync
          jobs.
        </p>
      </div>

      <AddProjectForm connections={connections} />

      <ProjectsTable projects={projects} />
    </div>
  );
}
