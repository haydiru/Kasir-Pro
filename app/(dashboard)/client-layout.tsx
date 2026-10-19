"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function DashboardClientLayout({
  children,
  user,
  actingAsCashier
}: {
  children: React.ReactNode;
  user: any;
  actingAsCashier?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar: icon rail on lg, full width from xl */}
      <Sidebar className="hidden lg:flex" variant="responsive" user={user} actingAsCashier={actingAsCashier} />

      {/* Mobile & tablet sidebar (below lg) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 data-[side=left]:w-64 data-[side=left]:max-w-[85vw]">
          <Sidebar 
            onNavigate={() => setMobileOpen(false)} 
            user={user} 
            actingAsCashier={actingAsCashier} 
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
