import { listConnections, listProjects } from "@/lib/services/projects";
import { getAuthContext } from "@/lib/auth/session";
import { AddProjectForm } from "./add-project-form";
import { ProjectsTable } from "./projects-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const authContext = await getAuthContext();
  const [projects, connections] = await Promise.all([
    listProjects(authContext),
    listConnections(authContext),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="page-heading">Projects</h2>
        <p className="page-subheading">
          Register GitHub or GitLab repositories and trigger background sync
          jobs.
        </p>
      </div>

      <AddProjectForm connections={connections} />

      <ProjectsTable projects={projects} />
    </div>
  );
}
