"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  ClipboardList,
  ShieldCheck,
  Users,
  Clock,
  FileText,
  History,
  Store,
  LogOut,
  KeyRound,
  Settings,
  FileEdit,
} from "lucide-react";
import { logOut } from "@/app/actions/auth";

const adminNav = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Riwayat Absensi", href: "/admin/attendance", icon: History },
  { label: "Verifikasi", href: "/admin/verifications", icon: ShieldCheck },
  { label: "Pengguna", href: "/admin/users", icon: Users },
  { label: "Pengaturan Toko", href: "/admin/store-settings", icon: Settings },
];

const cashierNav = [
  { label: "Laporan Shift", href: "/cashier/report", icon: ClipboardList },
  { label: "Riwayat", href: "/cashier/history", icon: History },
];

const pramuniagaNav = [
  { label: "Entri Data", href: "/pramuniaga/entries", icon: FileEdit },
];

const commonNav = [
  { label: "Presensi", href: "/attendance", icon: Clock },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  user?: any;
  actingAsCashier?: boolean;
}

export function Sidebar({ className, onNavigate, user, actingAsCashier }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isCashier = user?.role === "cashier" || !!actingAsCashier;

  const NavItem = ({
    item,
  }: {
    item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
  }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;

    // Filter which items match the role
    const isAdminItem = adminNav.some(n => n.href === item.href);
    const isKasirItem = cashierNav.some(n => n.href === item.href);
    const isPramuniagaItem = pramuniagaNav.some(n => n.href === item.href);
    const isUmumItem = commonNav.some(n => n.href === item.href);

    let canAccess = false;
    if (isAdmin) {
      canAccess = true; // Admin buka semua
    } else if (isCashier) {
      if (isKasirItem || isUmumItem) canAccess = true;
    } else {
      // Pramuniaga / Default
      if (isPramuniagaItem || isUmumItem) canAccess = true;
    }

    if (!canAccess) return null;

    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-4.5 w-4.5 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-accent-foreground"
          )}
        />
        {item.label}
        {isActive && (
          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar",
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight">KasirPro</span>
          <span className="text-[11px] text-muted-foreground leading-none">{user?.storeName || "KasirPro Store"}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {/* Admin section */}
        {(user?.role === "admin" || user?.role === "super_admin") && (
          <>
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Admin
            </p>
            {adminNav.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
            <Separator className="my-3" />
          </>
        )}

        {/* Kasir section */}
        {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "cashier" || !!actingAsCashier) && (
          <>
            <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Kasir
            </p>
            {cashierNav.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
            <Separator className="my-3" />
          </>
        )}

        {/* Pramuniaga section */}
        {(isAdmin || user?.role === "pramuniaga") && (
          <>
            <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Pramuniaga
            </p>
            {pramuniagaNav.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
            <Separator className="my-3" />
          </>
        )}

        {/* Common */}
        <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Umum
        </p>
        {commonNav.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      {/* User info */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "Kasir User"}</p>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 capitalize">
              {user?.role?.replace("_", " ")}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            <Link
              href="/change-pin"
              title="Ganti PIN"
              className="p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
            >
              <KeyRound className="h-4 w-4" />
            </Link>
            
            <form action={logOut}>
              <button
                type="submit"
                title="Keluar"
                className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
