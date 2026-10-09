import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { QuickActionFab } from "@/components/quick-action-fab";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { startAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    startAuth();
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 pb-32 md:pb-10 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <QuickActionFab />
      <Toaster />
    </div>
  );
}
