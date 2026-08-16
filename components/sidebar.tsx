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
  Smartphone,
  Wallet,
  Undo,
  Bell,
} from "lucide-react";
import { logOut } from "@/app/actions/auth";

const adminNav = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Riwayat Absensi", href: "/admin/attendance", icon: History },
  { label: "Verifikasi", href: "/admin/verifications", icon: ShieldCheck },
  { label: "Buku Kas", href: "/admin/cashflow", icon: Wallet },
  { label: "Transaksi Flip", href: "/admin/flip-transactions", icon: Smartphone },
  { label: "Pengguna", href: "/admin/users", icon: Users },
  { label: "Master Supplier", href: "/admin/suppliers", icon: Users },
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
  { label: "Notifikasi", href: "/notifications", icon: Bell },
  { label: "Barang Kosong", href: "/empty-items", icon: ClipboardList },
  { label: "Tagihan Supplier", href: "/cashier/bills", icon: FileText },
  { label: "Laporan Belanja Pegawai", href: "/shopping-funds", icon: Wallet },
  { label: "Barang Retur", href: "/retur", icon: Undo },
  { label: "Panduan", href: "/panduan", icon: FileText },
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
          "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary/12 text-primary font-semibold shadow-2xs"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-4.5 w-4.5 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
          )}
        />
        <span className="truncate">{item.label}</span>
        {isActive && (
          <span className="ml-auto h-2 w-2 rounded-full bg-primary ring-4 ring-primary/20" />
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar shrink-0 select-none",
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
          <Store className="h-5 w-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
            KasirPro
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] text-muted-foreground truncate leading-none mt-0.5">
            {user?.storeName || "KasirPro Store"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3.5 scrollbar-thin">
        {/* Admin section */}
        {(user?.role === "admin" || user?.role === "super_admin") && (
          <>
            <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Admin Menu
            </p>
            <div className="space-y-0.5">
              {adminNav.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
            <Separator className="my-3 opacity-60" />
          </>
        )}

        {/* Kasir section */}
        {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "cashier" || !!actingAsCashier) && (
          <>
            <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Kasir Menu
            </p>
            <div className="space-y-0.5">
              {cashierNav.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
            <Separator className="my-3 opacity-60" />
          </>
        )}

        {/* Pramuniaga section */}
        {(isAdmin || user?.role === "pramuniaga") && (
          <>
            <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Pramuniaga Menu
            </p>
            <div className="space-y-0.5">
              {pramuniagaNav.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
            <Separator className="my-3 opacity-60" />
          </>
        )}

        {/* Common */}
        <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Layanan Umum
        </p>
        <div className="space-y-0.5">
          {commonNav.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* User info */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-card border border-border/70 p-2.5 shadow-2xs">
          <div className="relative">
            <Avatar className="h-9 w-9 border border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate text-foreground">{user?.name || "Kasir User"}</p>
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.2 text-[9px] font-bold text-primary capitalize mt-0.5">
              {user?.role?.replace("_", " ")}
            </span>
          </div>
          
          <div className="flex items-center gap-0.5">
            <Link
              href="/change-pin"
              title="Ganti PIN"
              className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
            >
              <KeyRound className="h-4 w-4" />
            </Link>
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await logOut();
                } catch {
                  // Fallback
                } finally {
                  window.location.href = "/login";
                }
              }}
            >
              <button
                type="submit"
                title="Keluar"
                className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
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
