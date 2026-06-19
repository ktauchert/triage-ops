import { getProjectMetrics } from "@/lib/services/metrics";
import { listProjects, pickFavoriteProjectId } from "@/lib/services/projects";
import { getAuthContext } from "@/lib/auth/session";
import { DashboardMetrics } from "./dashboard-metrics";
import { ProjectSelector } from "./project-selector";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const authContext = await getAuthContext();
  const projects = await listProjects(authContext);
  const { project: projectParam } = await searchParams;
  const selectedProjectId = pickFavoriteProjectId(projects, projectParam);

  const metrics = selectedProjectId
    ? await getProjectMetrics(selectedProjectId)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="page-heading">Dashboard</h2>
        <p className="page-subheading">
          Triage metrics from your last issue sync.
        </p>
      </div>

      <ProjectSelector
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          pathWithNamespace: project.pathWithNamespace,
          isFavorite: project.isFavorite,
        }))}
        selectedProjectId={selectedProjectId}
      />

      <DashboardMetrics metrics={metrics} />
    </div>
  );
}
