import { AppSidebarNav, SidebarUser } from "@/components/app-sidebar";
import { CommandPaletteHint } from "@/components/command-palette";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { getAuthContext, getSessionUser } from "@/lib/auth/session";
import { getRoleCapabilities } from "@/lib/auth/permissions";
import { isAuthDisabled } from "@/lib/auth/config";

export async function AppSidebar() {
  const [user, authContext] = await Promise.all([
    getSessionUser(),
    getAuthContext(),
  ]);
  const capabilities = getRoleCapabilities(authContext.role);

  return (
    <aside className="glass flex h-full w-64 shrink-0 flex-col border-r shadow-xl shadow-black/[0.03] dark:shadow-black/30">
      <AppSidebarNav
        showAdminLink={capabilities.canAdminUsers}
        showConnectionsLink={capabilities.canManageConnections}
      />
      <div className="mt-auto">
        <Separator />
        <div className="space-y-3 p-4">
          <CommandPaletteHint />
          <ThemeToggle />
          {!isAuthDisabled() && user ? (
            <>
              <SidebarUser email={user.email} name={user.name} />
              <SignOutButton />
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
