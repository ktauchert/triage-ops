import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth/config";
import { isSetupComplete } from "@/lib/auth/setup";
import { AppSidebar } from "@/components/app-shell";
import { CommandPaletteRoot } from "@/components/command-palette-root";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAuthDisabled() && !(await isSetupComplete())) {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="relative flex-1 overflow-auto flex justify-start align-start">
        <div className="max-w-[1400px] px-6 py-8">{children}</div>
      </main>
      <CommandPaletteRoot />
    </div>
  );
}
