"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Link2, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

type SidebarUserProps = {
  email?: string | null;
  name?: string | null;
};

export function AppSidebarNav() {
  const pathname = usePathname();

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
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);

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
