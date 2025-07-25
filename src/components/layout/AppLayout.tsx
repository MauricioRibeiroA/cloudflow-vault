import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4">
            <SidebarTrigger className="mr-4" />
            <h1 className="font-semibold text-foreground">CloudFlow Vault</h1>
          </header>
          <main className="flex-1 p-6 bg-gradient-surface">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}