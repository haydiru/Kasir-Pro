"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationBell } from "./notification-bell";

const routeLabels: Record<string, string> = {
  "/admin/dashboard": "Dashboard Admin",
  "/admin/verifications": "Verifikasi Setoran",
  "/admin/users": "Manajemen Pengguna",
  "/cashier/report": "Laporan Shift",
  "/cashier/history": "Riwayat Laporan",
  "/attendance": "Presensi",
};

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const currentLabel = Object.entries(routeLabels).find(([key]) =>
    pathname.startsWith(key)
  )?.[1] || "Dashboard";

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/80 bg-background/85 backdrop-blur-md px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0 rounded-xl"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title & date */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
            {currentLabel}
          </h1>
          <span className="hidden md:inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Aktif
          </span>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block mt-0.5">{today}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle */}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-9 w-9 border-border/80 bg-card hover:bg-muted"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100 text-indigo-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
