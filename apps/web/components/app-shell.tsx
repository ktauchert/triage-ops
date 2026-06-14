import { AppSidebarNav, SidebarUser } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth/session";
import { isAuthDisabled } from "@/lib/auth/config";

export async function AppSidebar() {
  const user = await getSessionUser();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <AppSidebarNav />
      {!isAuthDisabled() && user ? (
        <>
          <Separator />
          <div className="space-y-3 p-4">
            <SidebarUser email={user.email} name={user.name} />
            <SignOutButton />
          </div>
        </>
      ) : null}
    </aside>
  );
}
