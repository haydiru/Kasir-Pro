"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Bell, Menu } from "lucide-react";
import { useTheme } from "next-themes";

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title & date */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold tracking-tight truncate">
          {currentLabel}
        </h1>
        <p className="text-xs text-muted-foreground hidden sm:block">{today}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4.5 w-4.5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4.5 w-4.5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
