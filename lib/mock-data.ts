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

/*
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
  ... (previously present content) ...
];

// ---------- Flip Webhooks ----------
export const flipWebhooks: FlipWebhook[] = [
  ... (previously present content) ...
];

// ---------- Revenue chart data ----------
export const revenueChartData = [
  ... (previously present content) ...
];
*/


// (Helper functions moved to @/lib/utils.ts)
