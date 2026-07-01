import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getProjectMetrics } from "@/lib/services/metrics";
import { getProjectById, listProjects } from "@/lib/services/projects";
import { getAuthContext } from "@/lib/auth/session";
import { getRoleCapabilities } from "@/lib/auth/permissions";
import { DashboardMetrics } from "../../dashboard-metrics";
import { ProjectSelector } from "../project-selector";

export const dynamic = "force-dynamic";

type ProjectDashboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDashboardPage({
  params,
}: ProjectDashboardPageProps) {
  const { id } = await params;
  const authContext = await getAuthContext();
  const project = await getProjectById(authContext, id);

  if (!project) {
    notFound();
  }

  const [projects, metrics] = await Promise.all([
    listProjects(authContext),
    getProjectMetrics(id),
  ]);

  const capabilities = getRoleCapabilities(authContext.role);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: project.name },
        ]}
      />

      <div>
        <h2 className="page-heading">{project.name}</h2>
        <p className="page-subheading">
          Signals from your last sync.
        </p>
      </div>

      <ProjectSelector
        projects={projects.map((entry) => ({
          id: entry.id,
          name: entry.name,
          pathWithNamespace: entry.pathWithNamespace,
          isFavorite: entry.isFavorite,
        }))}
        selectedProjectId={id}
      />

      <DashboardMetrics metrics={metrics} capabilities={capabilities} />
    </div>
  );
}
