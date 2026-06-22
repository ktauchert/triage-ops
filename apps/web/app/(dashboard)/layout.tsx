import { AppSidebar } from "@/components/app-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="relative flex-1 overflow-auto flex justify-start align-start">
        <div className="max-w-[1400px] px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
