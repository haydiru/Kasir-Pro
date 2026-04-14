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

export function formatDateTime(iso: string | Date, timeZone?: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: timeZone || "Asia/Jakarta"
  });
}

export function formatTime(iso: string | Date, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
    timeZone: timeZone || "Asia/Jakarta"
  });
}

/**
 * Returns a date string (YYYY-MM-DD) in a specific timezone.
 */
export function formatLocalDate(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", { // en-CA gives YYYY-MM-DD
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns a full Indonesian date string (e.g. Selasa, 14 April 2026) in a specific timezone.
 */
export function formatFullLocalDate(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    timeZone
  });
}

/**
 * Returns the start and end of a given date in a specific timezone, 
 * but as UTC Date objects for database querying.
 */
export function getTZDateRange(date: Date, timeZone: string) {
  // 1. Get the local YYYY-MM-DD in the target TZ
  const isoDate = formatLocalDate(date, timeZone); // "YYYY-MM-DD"
  
  // 2. Construct the start and end in the local TZ
  const startLocal = `${isoDate}T00:00:00`;
  const endLocal = `${isoDate}T23:59:59.999`;
  
  // 3. Convert these to exact UTC moments
  const getUTC = (s: string) => {
    const d = new Date(s);
    const inv = new Date(d.toLocaleString("en-US", { timeZone }));
    const diff = d.getTime() - inv.getTime();
    return new Date(d.getTime() + diff);
  };

  return { 
    start: getUTC(startLocal), 
    end: getUTC(endLocal) 
  };
}

/**
 * Returns the start and end of a given month in a specific timezone,
 * as UTC Date objects.
 */
export function getTZMonthRange(year: number, month: number, timeZone: string) {
  const getUTC = (s: string) => {
    const d = new Date(s);
    const inv = new Date(d.toLocaleString("en-US", { timeZone }));
    const diff = d.getTime() - inv.getTime();
    return new Date(d.getTime() + diff);
  };

  // Month is 1-indexed (1-12)
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
  
  // Get last day by going to the next month and subtracting 1 day
  const dateObj = new Date(year, month, 0); // month is already 1-indexed here, so this gives last day of 'month'
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}T23:59:59.999`;

  return {
    start: getUTC(firstDay),
    end: getUTC(lastDay)
  };
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
