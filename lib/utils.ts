import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------- Formatting Helpers ----------

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------- UI & Role Helpers ----------

export function getRoleBadgeVariant(role: string) {
  const map: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    super_admin: "default",
    admin: "default",
    cashier: "secondary",
    pramuniaga: "outline",
  };
  return map[role] || "default";
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    cashier: "Kasir",
    pramuniaga: "Pramuniaga",
  };
  return map[role] || role;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: "bg-muted text-muted-foreground",
    Submitted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Verified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  };
  return map[status] || "bg-muted text-muted-foreground";
}

// ---------- Report Summary Helpers ----------

/** Summarize expenditure by payment source */
export function calcExpenditureSummary(expenditures: any[]) {
  const fromBill = expenditures.reduce((sum, e) => sum + (e.amountFromBill || 0), 0);
  const fromCashier = expenditures.reduce((sum, e) => sum + (e.amountFromCashier || 0), 0);
  const fromTransfer = expenditures.reduce((sum, e) => sum + (e.amountFromTransfer || 0), 0);
  const total = fromBill + fromCashier + fromTransfer;
  return { fromBill, fromCashier, fromTransfer, total };
}

/** Get total of each expenditure item */
export function getExpenditureTotal(e: any): number {
  return (e.amountFromBill || 0) + (e.amountFromCashier || 0) + (e.amountFromTransfer || 0);
}

/** Calculate expected cash from a report. */
export function calcExpectedCash(report: any): number {
  if (!report) return 0;
  
  const digitalCashIn = (report.digitalTransactions || [])
    .filter((d: any) => !d.isNonCash)
    .reduce((sum: number, d: any) => sum + (d.grossAmount || 0), 0);
    
  const expenditureFromCashier = (report.expenditures || [])
    .reduce((sum: number, e: any) => sum + (e.amountFromCashier || 0), 0);

  return Math.round((report.startingCash || 0) + (report.posCash || 0) + digitalCashIn - expenditureFromCashier);
}
