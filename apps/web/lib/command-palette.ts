import type { RoleCapabilities } from "@/lib/auth/permissions";
import { projectDashboardPath } from "@/lib/navigation";

export type CommandPaletteProject = {
  id: string;
  name: string;
  pathWithNamespace: string;
  isFavorite: boolean;
};

export type CommandPaletteItem = {
  id: string;
  label: string;
  keywords: string;
  href: string;
  group: "Navigation" | "Projects" | "Admin";
};

export function buildCommandPaletteItems(
  projects: CommandPaletteProject[],
  capabilities: RoleCapabilities,
): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [
    {
      id: "nav-home",
      label: "Home",
      keywords: "home welcome dashboard start",
      href: "/",
      group: "Navigation",
    },
    {
      id: "nav-projects",
      label: "All projects",
      keywords: "projects list register sync",
      href: "/projects",
      group: "Navigation",
    },
  ];

  if (capabilities.canManageConnections) {
    items.push({
      id: "nav-connections",
      label: "Connections",
      keywords: "connections gitlab github token pat vcs",
      href: "/connections",
      group: "Navigation",
    });
  }

  if (capabilities.canAdminUsers) {
    items.push(
      {
        id: "admin-overview",
        label: "Admin overview",
        keywords: "admin console overview users invites",
        href: "/admin",
        group: "Admin",
      },
      {
        id: "admin-users",
        label: "Manage users",
        keywords: "admin users invite roles",
        href: "/admin/users",
        group: "Admin",
      },
      {
        id: "admin-jobs",
        label: "Background jobs",
        keywords: "admin jobs sync analysis writeback failures",
        href: "/admin/jobs",
        group: "Admin",
      },
      {
        id: "admin-audit",
        label: "Audit log",
        keywords: "admin audit log history actions",
        href: "/admin/audit",
        group: "Admin",
      },
    );
  }

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  for (const project of sortedProjects) {
    items.push({
      id: `project-${project.id}`,
      label: project.isFavorite ? `${project.name} ★` : project.name,
      keywords: `${project.name} ${project.pathWithNamespace} project triage dashboard`,
      href: projectDashboardPath(project.id),
      group: "Projects",
    });
  }

  return items;
}

export function groupCommandPaletteItems(
  items: CommandPaletteItem[],
): Array<{ group: CommandPaletteItem["group"]; items: CommandPaletteItem[] }> {
  const order: CommandPaletteItem["group"][] = [
    "Navigation",
    "Projects",
    "Admin",
  ];

  return order
    .map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((entry) => entry.items.length > 0);
}
