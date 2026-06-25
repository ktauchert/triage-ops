"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  FolderKanban,
  Home,
  Link2,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const workspaceNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
] as const;

const connectionsNavItem = {
  href: "/connections",
  label: "Connections",
  icon: Link2,
} as const;

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: Shield,
} as const;

const adminConsoleNavItems = [
  { href: "/admin", label: "Overview", icon: Shield },
  { href: "/admin/jobs", label: "Jobs", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
] as const;

type SidebarUserProps = {
  email?: string | null;
  name?: string | null;
};

type AppSidebarNavProps = {
  showAdminLink?: boolean;
  showConnectionsLink?: boolean;
};

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (href === "/projects") {
    return pathname === "/projects";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebarNav({
  showAdminLink = false,
  showConnectionsLink = false,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const isAdminConsole = pathname.startsWith("/admin");

  if (isAdminConsole) {
    return (
      <>
        <div className="px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
            TriageOps
          </p>
          <h1 className="text-lg font-semibold tracking-tight">Admin console</h1>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {adminConsoleNavItems.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "border border-primary/20 bg-primary/15 text-primary shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/"
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Link>
        </nav>
      </>
    );
  }

  const navItems = [
    ...workspaceNavItems,
    ...(showConnectionsLink ? [connectionsNavItem] : []),
    ...(showAdminLink ? [adminNavItem] : []),
  ];

  return (
    <>
      <div className="px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
          TriageOps
        </p>
        <h1 className="text-lg font-semibold tracking-tight">Issue Triage</h1>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "border border-primary/20 bg-primary/15 text-primary shadow-sm shadow-primary/10"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function SidebarUser({ email, name }: SidebarUserProps) {
  return (
    <div className="px-1 text-xs text-muted-foreground">
      <p className="truncate font-medium text-foreground">{name ?? email}</p>
      {name && email ? <p className="truncate">{email}</p> : null}
    </div>
  );
}
