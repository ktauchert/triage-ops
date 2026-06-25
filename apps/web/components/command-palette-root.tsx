import { getAuthContext } from "@/lib/auth/session";
import { getRoleCapabilities } from "@/lib/auth/permissions";
import { listProjects } from "@/lib/services/projects";
import { CommandPalette } from "@/components/command-palette";

export async function CommandPaletteRoot() {
  const authContext = await getAuthContext();
  const [projects, capabilities] = await Promise.all([
    listProjects(authContext),
    Promise.resolve(getRoleCapabilities(authContext.role)),
  ]);

  return (
    <CommandPalette
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        pathWithNamespace: project.pathWithNamespace,
        isFavorite: project.isFavorite,
      }))}
      capabilities={capabilities}
    />
  );
}
