// ============================================================
// Mock Data — Kasir Minimarket Shift Report
// ============================================================

export type Role = "super_admin" | "admin" | "cashier" | "pramuniaga";
export type ShiftType = string;
export type ReportStatus = "Draft" | "Submitted" | "Verified";

export interface Store {
  id: string;
  name: string;
  address: string;
}

export interface User {
  id: string;
  storeId: string;
  role: Role;
  name: string;
  email: string;
  payrollCycleStart: number;
  payrollCycleEnd: number;
}

export interface Attendance {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  clockIn: string;
  clockOut: string | null;
  shiftType: ShiftType;
  actingAsCashier: boolean;
}

export interface DigitalTransaction {
  id: string;
  serviceType: "Transfer" | "Top Up E-Walet" | "Pulsa/Paket Data" | "Listrik" | "PDAM" | "Indihome" | "Lainnya";
  grossAmount: number;
  profitAmount: number;
  detailContact: string;
  flipId: string;
  isNonCash: boolean;
  paymentMethod: "QRIS" | "Debit BCA" | "";
  createdBy?: string;
  lastUpdatedBy?: string;
  createdByName?: string; // Tag siapa yang menginput (Kasir/Pramuniaga)
  updatedByName?: string; // Tag siapa yang terakhir mengedit
}

export interface Expenditure {
  id: string;
  supplierName: string;
  amountFromBill: number;      // Uang Tagihan
  amountFromCashier: number;   // Uang Kasir
  amountFromTransfer: number;  // Transfer (tidak pengaruhi rekap cash)
  receiptUrl?: string; // Menjadi optional karena tidak harus selalu ada
  createdBy?: string;
  lastUpdatedBy?: string;
  createdByName?: string; // Tag siapa yang menginput (Kasir/Pramuniaga)
  updatedByName?: string; // Tag siapa yang terakhir mengedit
}

export interface ShiftReport {
  id: string;
  userId: string;
  userName: string;
  storeId: string;
  storeName: string;
  date: string;
  shiftType: ShiftType;
  status: ReportStatus;
  startingCash: number;
  billMoneyReceived: number;  // Uang Tagihan Masuk (input manual, terpisah dari modal)
  posCash: number;
  posDebit: number;
  manualCashCount: number;
  digitalTransactions: DigitalTransaction[];
  expenditures: Expenditure[];
  finalAdminVariance: number | null;
  adminNotes: string;
  submittedAt: string | null;
  verifiedAt: string | null;
}

export interface FlipWebhook {
  flipId: string;
  nominal: number;
  transactionTime: string;
  matched: boolean;
}

// ---------- Stores ----------
export const stores: Store[] = [
  { id: "s1", name: "Minimart Sejahtera - Pusat", address: "Jl. Merdeka No. 12, Jakarta Pusat" },
  { id: "s2", name: "Minimart Sejahtera - Cabang Selatan", address: "Jl. Fatmawati No. 88, Jakarta Selatan" },
];

// ---------- Users ----------
export const users: User[] = [
  { id: "u1", storeId: "s1", role: "super_admin", name: "Budi Santoso", email: "budi@minimart.id", payrollCycleStart: 1, payrollCycleEnd: 30 },
  { id: "u2", storeId: "s1", role: "admin", name: "Siti Rahmawati", email: "siti@minimart.id", payrollCycleStart: 1, payrollCycleEnd: 30 },
  { id: "u3", storeId: "s1", role: "cashier", name: "Andi Wijaya", email: "andi@minimart.id", payrollCycleStart: 1, payrollCycleEnd: 30 },
  { id: "u4", storeId: "s1", role: "cashier", name: "Dewi Lestari", email: "dewi@minimart.id", payrollCycleStart: 5, payrollCycleEnd: 4 },
  { id: "u5", storeId: "s1", role: "pramuniaga", name: "Riko Pratama", email: "riko@minimart.id", payrollCycleStart: 1, payrollCycleEnd: 30 },
  { id: "u6", storeId: "s2", role: "admin", name: "Maya Sari", email: "maya@minimart.id", payrollCycleStart: 1, payrollCycleEnd: 30 },
  { id: "u7", storeId: "s2", role: "cashier", name: "Fajar Nugroho", email: "fajar@minimart.id", payrollCycleStart: 1, payrollCycleEnd: 30 },
];

// ---------- Attendance (today) ----------
export const attendances: Attendance[] = [
  { id: "a1", userId: "u3", userName: "Andi Wijaya", role: "cashier", clockIn: "2026-04-12T06:55:00", clockOut: "2026-04-12T14:05:00", shiftType: "Pagi", actingAsCashier: false },
  { id: "a2", userId: "u5", userName: "Riko Pratama", role: "pramuniaga", clockIn: "2026-04-12T06:58:00", clockOut: null, shiftType: "Pagi", actingAsCashier: false },
  { id: "a3", userId: "u4", userName: "Dewi Lestari", role: "cashier", clockIn: "2026-04-12T13:50:00", clockOut: null, shiftType: "Malam", actingAsCashier: false },
  { id: "a4", userId: "u7", userName: "Fajar Nugroho", role: "cashier", clockIn: "2026-04-12T07:02:00", clockOut: null, shiftType: "Pagi", actingAsCashier: false },
];

// ---------- Shift Reports ----------
export const shiftReports: ShiftReport[] = [
  {
    id: "sr1",
    userId: "u3",
    userName: "Andi Wijaya",
    storeId: "s1",
    storeName: "Minimart Sejahtera - Pusat",
    date: "2026-04-12",
    shiftType: "Pagi",
    status: "Submitted",
    startingCash: 500000,
    billMoneyReceived: 1500000,
    posCash: 3250000,
    posDebit: 1450000,
    manualCashCount: 2185000,
    digitalTransactions: [
      { id: "dt1", serviceType: "Transfer", grossAmount: 550000, profitAmount: 5500, detailContact: "0812-3456-7890 a/n Hendra", flipId: "FLP-20260412-001", isNonCash: false, paymentMethod: "", createdByName: "Andi Wijaya" },
      { id: "dt2", serviceType: "Top Up E-Walet", grossAmount: 105000, profitAmount: 2000, detailContact: "OVO 0898-7654-321", flipId: "", isNonCash: true, paymentMethod: "QRIS", createdByName: "Nina (Pramuniaga)" },
      { id: "dt3", serviceType: "Transfer", grossAmount: 1200000, profitAmount: 7500, detailContact: "BCA 1234567890 a/n Rina", flipId: "FLP-20260412-003", isNonCash: false, paymentMethod: "", createdByName: "Andi Wijaya" },
    ],
    expenditures: [
      { id: "e1", supplierName: "PT Indofood", amountFromBill: 500000, amountFromCashier: 350000, amountFromTransfer: 0, receiptUrl: "/receipts/nota-indofood.jpg", createdByName: "Nina (Pramuniaga)" },
      { id: "e2", supplierName: "Toko Es Batu Makmur", amountFromBill: 0, amountFromCashier: 75000, amountFromTransfer: 0, receiptUrl: "/receipts/nota-es.jpg", createdByName: "Andi Wijaya" },
    ],
    finalAdminVariance: null,
    adminNotes: "",
    submittedAt: "2026-04-12T14:02:00",
    verifiedAt: null,
  },
  {
    id: "sr2",
    userId: "u4",
    userName: "Dewi Lestari",
    storeId: "s1",
    storeName: "Minimart Sejahtera - Pusat",
    date: "2026-04-11",
    shiftType: "Malam",
    status: "Verified",
    startingCash: 500000,
    billMoneyReceived: 800000,
    posCash: 2100000,
    posDebit: 980000,
    manualCashCount: 1580000,
    digitalTransactions: [
      { id: "dt4", serviceType: "Transfer", grossAmount: 300000, profitAmount: 4000, detailContact: "0877-xxx a/n Doni", flipId: "FLP-20260411-010", isNonCash: false, paymentMethod: "" },
    ],
    expenditures: [
      { id: "e3", supplierName: "Distributor Aqua", amountFromBill: 200000, amountFromCashier: 220000, amountFromTransfer: 0, receiptUrl: "/receipts/nota-aqua.jpg" },
    ],
    finalAdminVariance: -5000,
    adminNotes: "Selisih minor, uang kembalian kurang Rp5.000.",
    submittedAt: "2026-04-11T22:10:00",
    verifiedAt: "2026-04-11T23:00:00",
  },
  {
    id: "sr3",
    userId: "u7",
    userName: "Fajar Nugroho",
    storeId: "s2",
    storeName: "Minimart Sejahtera - Cabang Selatan",
    date: "2026-04-11",
    shiftType: "Pagi",
    status: "Submitted",
    startingCash: 500000,
    billMoneyReceived: 500000,
    posCash: 2800000,
    posDebit: 1200000,
    manualCashCount: 1920000,
    digitalTransactions: [
      { id: "dt5", serviceType: "Top Up E-Walet", grossAmount: 55000, profitAmount: 1500, detailContact: "DANA 081234567", flipId: "", isNonCash: true, paymentMethod: "QRIS" },
      { id: "dt6", serviceType: "Transfer", grossAmount: 750000, profitAmount: 5000, detailContact: "Mandiri 9876xx a/n Yuni", flipId: "FLP-20260411-015", isNonCash: false, paymentMethod: "" },
    ],
    expenditures: [],
    finalAdminVariance: null,
    adminNotes: "",
    submittedAt: "2026-04-11T14:15:00",
    verifiedAt: null,
  },
];

// ---------- Flip Webhooks ----------
export const flipWebhooks: FlipWebhook[] = [
  { flipId: "FLP-20260412-001", nominal: 550000, transactionTime: "2026-04-12T08:23:00", matched: true },
  { flipId: "FLP-20260412-002", nominal: 200000, transactionTime: "2026-04-12T10:15:00", matched: false },
  { flipId: "FLP-20260412-003", nominal: 1200000, transactionTime: "2026-04-12T11:45:00", matched: true },
];

// ---------- Revenue chart data ----------
export const revenueChartData = [
  { date: "07 Apr", tunai: 2800000, debit: 1100000, digital: 350000 },
  { date: "08 Apr", tunai: 3100000, debit: 1350000, digital: 420000 },
  { date: "09 Apr", tunai: 2650000, debit: 1200000, digital: 280000 },
  { date: "10 Apr", tunai: 3500000, debit: 1600000, digital: 510000 },
  { date: "11 Apr", tunai: 2900000, debit: 1180000, digital: 380000 },
  { date: "12 Apr", tunai: 3250000, debit: 1450000, digital: 460000 },
];

// ---------- Helpers ----------
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
  });
}

export function getRoleBadgeVariant(role: Role) {
  const map: Record<Role, "default" | "secondary" | "outline" | "destructive"> = {
    super_admin: "default",
    admin: "default",
    cashier: "secondary",
    pramuniaga: "outline",
  };
  return map[role];
}

export function getRoleLabel(role: Role): string {
  const map: Record<Role, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    cashier: "Kasir",
    pramuniaga: "Pramuniaga",
  };
  return map[role];
}

export function getStatusColor(status: ReportStatus): string {
  const map: Record<ReportStatus, string> = {
    Draft: "bg-muted text-muted-foreground",
    Submitted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Verified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  };
  return map[status];
}

/** Summarize expenditure by payment source */
export function calcExpenditureSummary(expenditures: Expenditure[]) {
  const fromBill = expenditures.reduce((sum, e) => sum + e.amountFromBill, 0);
  const fromCashier = expenditures.reduce((sum, e) => sum + e.amountFromCashier, 0);
  const fromTransfer = expenditures.reduce((sum, e) => sum + e.amountFromTransfer, 0);
  const total = fromBill + fromCashier + fromTransfer;
  return { fromBill, fromCashier, fromTransfer, total };
}

/** Get total of each expenditure item */
export function getExpenditureTotal(e: Expenditure): number {
  return e.amountFromBill + e.amountFromCashier + e.amountFromTransfer;
}

/** Calculate expected cash from a report.
 *  Digital: only grossAmount (Modal+Laba) for cash transactions goes into cash calc.
 *  Laba Digital is stored separately for statistics, NOT added to cash recap.
 *  Only "Uang Kasir" expenditures reduce the cash drawer.
 *  "Uang Tagihan" & "Transfer" have no cash impact. */
export function calcExpectedCash(report: ShiftReport): number {
  const digitalCashIn = report.digitalTransactions
    .filter(d => !d.isNonCash)
    .reduce((sum, d) => sum + d.grossAmount, 0);
  const expenditureFromCashier = report.expenditures.reduce((sum, e) => sum + e.amountFromCashier, 0);

  return report.startingCash + report.posCash + digitalCashIn - expenditureFromCashier;
}
