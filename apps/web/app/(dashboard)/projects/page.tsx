import { listConnections, listProjects } from "@/lib/services/projects";
import { fetchProjectsHealthMap } from "@/lib/services/project-health";
import { getAuthContext } from "@/lib/auth/session";
import { getRoleCapabilities } from "@/lib/auth/permissions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddProjectForm } from "./add-project-form";
import { ProjectsTable } from "./projects-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const authContext = await getAuthContext();
  const projects = await listProjects(authContext);
  const [connections, healthByProjectId] = await Promise.all([
    listConnections(authContext),
    fetchProjectsHealthMap(projects),
  ]);
  const capabilities = getRoleCapabilities(authContext.role);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Projects" },
        ]}
      />

      <div>
        <h2 className="page-heading">Projects</h2>
        <p className="page-subheading">
          Register GitHub or GitLab repositories and trigger background sync
          jobs.
        </p>
      </div>

      {capabilities.canManageProjects ? (
        <AddProjectForm connections={connections} />
      ) : null}

      <ProjectsTable
        projects={projects}
        healthByProjectId={healthByProjectId}
        canManage={capabilities.canManageProjects}
        canSync={capabilities.canSync}
        canEditSettings={capabilities.canEditSettings}
      />
    </div>
  );
}
