"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Save,
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wallet,
  CreditCard,
  Smartphone,
  ShoppingBag,
  Calculator,
  UploadCloud,
  UserSquare2,
  FileEdit,
  ClipboardList,
} from "lucide-react";
import {
  formatCurrency,
  formatDateTime,
  getRoleLabel,
  getStatusColor,
  formatFullLocalDate,
  formatLocalDate
} from "@/lib/utils";
import {
  type DigitalTransaction,
  type Expenditure,
} from "@/lib/mock-data";
import { toast } from "sonner";
import { getActiveReport, createShiftReport, saveCashierReport, getReportById } from "@/app/actions/report";
import { getAvailableShifts } from "@/app/actions/attendance-shifts";
import { getActiveAttendance } from "@/app/actions/attendance";
import { getUnmatchedFlipForReport } from "@/app/actions/flip";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// Generate unique ID
const uid = () => Math.random().toString(36).slice(2, 9);

const emptyDigitalTx = (): DigitalTransaction => ({
  id: uid(),
  serviceType: "Transfer",
  grossAmount: 0,
  profitAmount: 0,
  detailContact: "",
  flipId: "",
  isNonCash: false,
  paymentMethod: "",
});

const emptyExpenditure = (): Expenditure => ({
  id: uid(),
  supplierName: "",
  amountFromBill: 0,
  amountFromCashier: 0,
  amountFromTransfer: 0,
  receiptUrl: "",
});

export default function CashierReportPage() {
  // Section 1: Shift Info
  const todayDateStr = new Date().toISOString().split("T")[0];
  const [shiftType, setShiftType] = useState<string>("");
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [startingCash, setStartingCash] = useState(500000);
  const [billMoneyReceived, setBillMoneyReceived] = useState(0);

  // Section 2: POS
  const [posCash, setPosCash] = useState(0);
  const [posDebit, setPosDebit] = useState(0);

  // Section 3: Digital Transactions
  const [digitalTx, setDigitalTx] = useState<DigitalTransaction[]>([]);

  // Section 4: Expenditures
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);

  // Section 5: Manual count
  const [manualCashCount, setManualCashCount] = useState(0);

  // Status
  const [reportId, setReportId] = useState<string | null>(null);
  const [status, setStatus] = useState<"Draft" | "Submitted" | "Verified">("Draft");
  const [autoSaving, setAutoSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevising, setIsRevising] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [reportOwnerName, setReportOwnerName] = useState<string>("");
  const [actingAsCashier, setActingAsCashier] = useState(false);
  
  // Flip integration state
  const [unmatchedFlips, setUnmatchedFlips] = useState<any[]>([]);
  const [noAttendance, setNoAttendance] = useState(false);
  const [noActiveReport, setNoActiveReport] = useState(false);
  const [activeShiftInfo, setActiveShiftInfo] = useState<{name: string, date: string} | null>(null);
  const [storeTimezone, setStoreTimezone] = useState("Asia/Jakarta");
  const [isCreatingReport, setIsCreatingReport] = useState(false);

  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get("id");

  // Load report on mount
  useEffect(() => {
    async function init() {
      try {
        const [reportRes, attendanceRes] = await Promise.all([
            targetId ? getReportById(targetId) : getActiveReport(),
            getActiveAttendance()
        ]);

        if (attendanceRes.success && attendanceRes.data) {
            setActingAsCashier(!!attendanceRes.data.actingAsCashier);
        }

        if (reportRes.success && reportRes.data) {
          setStoreTimezone(reportRes.data.timezone || "Asia/Jakarta");
        }

        if (!reportRes.success) {
          if (reportRes.error === "AttendanceRequired" && !targetId) {
            setNoAttendance(true);
          } else if (reportRes.error === "NoActiveReport" && !targetId) {
            setNoActiveReport(true);
            setActiveShiftInfo({
              name: reportRes.data?.shiftType,
              date: reportRes.data?.date ? formatFullLocalDate(reportRes.data.date, reportRes.data.timezone || "Asia/Jakarta") : ""
            });
          } else {
            toast.error(reportRes.error || "Gagal memuat laporan.");
          }
          return;
        }

        const { report } = reportRes.data;
        if (report) {
          setReportId(report.id);
          setShiftType(report.shiftType as any);
          setStartingCash(report.startingCash);
          setPosCash(report.posCash);
          setPosDebit(report.posDebit);
          setBillMoneyReceived(report.billMoneyReceived);
          setManualCashCount(report.manualCashCount);
          setStatus(report.status as any);
          setReportOwnerName(report.user?.name || "");
          
          if (report.digitalTransactions) {
            setDigitalTx(report.digitalTransactions.map((t: any) => ({
                ...t,
                createdByName: t.creator?.name,
                updatedByName: t.updater?.name
            })));
          }
          if (report.expenditures) {
            setExpenditures(report.expenditures.map((e: any) => ({
                ...e,
                createdByName: e.creator?.name,
                updatedByName: e.updater?.name
            })));
          }

          // Fetch Flip unmatched
          const flipRes = await getUnmatchedFlipForReport(report.id);
          if (flipRes.success && flipRes.data) {
            setUnmatchedFlips(flipRes.data);
          }
        }
      } catch (err) {
        toast.error("Gagal memuat laporan aktif.");
      } finally {
        setIsLoading(false);
      }
    }
    
    async function loadShifts() {
        const res = await getAvailableShifts();
        if (res.success && res.data) {
            setAvailableShifts(res.data);
        }
    }

    init();
    loadShifts();
  }, [router]);

  // Calculate expected cash
  const digitalCashIn = digitalTx
    .filter((d) => !d.isNonCash)
    .reduce((sum, d) => sum + d.grossAmount, 0);

  // Expenditure breakdown by payment source
  const expFromBill = expenditures.reduce((sum, e) => sum + e.amountFromBill, 0);
  const expFromCashier = expenditures.reduce((sum, e) => sum + e.amountFromCashier, 0);
  const expFromTransfer = expenditures.reduce((sum, e) => sum + e.amountFromTransfer, 0);
  const totalExpenditure = expFromBill + expFromCashier + expFromTransfer;

  // Sisa Uang Tagihan = manual input - used for expenses
  const sisaUangTagihan = billMoneyReceived - expFromBill;

  // Only Uang Kasir affects the cash drawer. Digital grossAmount (tunai) masuk ke rekap cash.
  // Laba Digital TIDAK masuk ke kalkulasi cash (hanya untuk statistik DB).
  const expectedCash = Math.round(startingCash + posCash + digitalCashIn - expFromCashier);
  const variance = Math.round(manualCashCount - expectedCash);

  // Auto-save: debounce 5s, tracks ALL form fields, skips if nothing changed
  const lastSavedRef = useCallback(() => ({ current: "" }), [])();

  useEffect(() => {
    if (status === "Submitted" || !reportId) return;

    // Skip auto-saving if there's any empty supplier name to prevent database clutter/validation errors
    const hasEmptySupplier = expenditures.some((ex) => !ex.supplierName || ex.supplierName.trim() === "");
    if (hasEmptySupplier) return;

    // Build a lightweight snapshot of current form state
    const snapshot = JSON.stringify({
      startingCash, posCash, posDebit, billMoneyReceived, manualCashCount,
      dt: digitalTx.map(d => ({ s: d.serviceType, g: d.grossAmount, p: d.profitAmount, c: d.detailContact, n: d.isNonCash, m: d.paymentMethod })),
      ex: expenditures.map(e => ({ s: e.supplierName, b: e.amountFromBill, c: e.amountFromCashier, t: e.amountFromTransfer })),
    });

    // Skip if nothing changed since last save
    if (snapshot === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      lastSavedRef.current = snapshot;
      handleSave(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [posCash, posDebit, startingCash, billMoneyReceived, manualCashCount, digitalTx, expenditures, status, reportId]);


  // Digital transaction handlers
  const addDigitalRow = () => setDigitalTx((prev) => [...prev, emptyDigitalTx()]);
  const removeDigitalRow = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus baris transaksi ini?")) {
      setDigitalTx((prev) => prev.filter((d) => d.id !== id));
    }
  };
  const updateDigitalTx = (id: string, field: keyof DigitalTransaction, value: unknown) => {
    setDigitalTx((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const updated = { ...d, [field]: value };
        // Reset payment method if non-cash unchecked
        if (field === "isNonCash" && !value) {
          updated.paymentMethod = "";
        }
        return updated;
      })
    );
  };

  // Expenditure handlers
  const addExpenditure = () => setExpenditures((prev) => [...prev, emptyExpenditure()]);
  const removeExpenditure = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus baris pengeluaran ini?")) {
      setExpenditures((prev) => prev.filter((e) => e.id !== id));
    }
  };
  const updateExpenditure = (id: string, field: keyof Expenditure, value: unknown) => {
    setExpenditures((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!reportId) return;

    const hasEmptySupplier = expenditures.some((ex) => !ex.supplierName || ex.supplierName.trim() === "");
    if (hasEmptySupplier) {
      toast.error("Nama supplier harus diisi!", {
        description: "Mohon isi nama supplier pada semua baris pengeluaran, atau hapus baris yang kosong jika tidak digunakan."
      });
      return;
    }

    setIsLoading(true);
    const res = await saveCashierReport({
        id: reportId,
        startingCash,
        posCash,
        posDebit,
        billMoneyReceived,
        manualCashCount,
        digitalTransactions: digitalTx,
        expenditures: expenditures,
        isSubmit: true
    });
    setIsLoading(false);

    if (res.success) {
      setStatus("Submitted");
      toast.success("Laporan berhasil di-submit!", {
        description: "Admin akan menerima laporan ini untuk diverifikasi.",
      });
    } else {
        toast.error(res.error);
    }
  };

  // Manual save
  const handleSave = async (isAuto = false, isRevisionSubmit = false) => {
    // Prevent auto-save if already submitted and not in revision mode
    if (!reportId || (status === "Submitted" && !isRevising)) return;

    // Validation for manual save or revision submit
    if (!isAuto) {
      const hasEmptySupplier = expenditures.some((ex) => !ex.supplierName || ex.supplierName.trim() === "");
      if (hasEmptySupplier) {
        toast.error("Nama supplier harus diisi!", {
          description: "Mohon isi nama supplier pada semua baris pengeluaran, atau hapus baris yang kosong jika tidak digunakan."
        });
        return;
      }
    }
    
    if (!isAuto) setAutoSaving(true);
    
    // If it's a manual save (not auto), and we are in revision mode, 
    // we want to maintain the Submitted status if it was already submitted.
    // However, the action will set it to Draft if isSubmit is false.
    // So if isRevisionSubmit is true, we pass isSubmit: true.
    const res = await saveCashierReport({
        id: reportId,
        startingCash,
        posCash,
        posDebit,
        billMoneyReceived,
        manualCashCount,
        digitalTransactions: digitalTx,
        expenditures: expenditures,
        isSubmit: isRevisionSubmit || (status === "Submitted" && isRevising),
        editReason: isRevising ? editReason : undefined
    });

    if (!isAuto) setAutoSaving(false);
    
    if (!isAuto && res.success) {
      toast(isRevisionSubmit || isRevising ? "Revisi disimpan" : "Draft disimpan", {
        icon: isRevising ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Save className="h-4 w-4" />,
        description: isRevising ? "Laporan berhasil diperbarui dengan catatan revisi." : "Perubahan terakhir berhasil disimpan secara manual.",
      });
      if (isRevising) {
          setIsRevising(false);
          setEditReason("");
      }
    } else if (!isAuto && !res.success) {
      toast.error(res.error);
    }
  };

  const handleCreateReport = async () => {
    setIsCreatingReport(true);
    try {
      const res = await createShiftReport();
      if (res.success && res.data?.report) {
        const { report } = res.data;
        setReportId(report.id);
        setShiftType(report.shiftType);
        setStartingCash(report.startingCash);
        setStatus(report.status);
        setReportOwnerName(report.user?.name || "");
        setNoActiveReport(false);
        toast.success("Laporan shift dimulai!");
      } else {
        toast.error(res.error || "Gagal membuat laporan");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsCreatingReport(false);
    }
  };

  const inputDisabled = status === "Submitted" && !isRevising;

  if (isLoading) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="animate-pulse font-medium">Menghubungkan ke Laporan Shift Aktif...</p>
        </div>
    );
  }

  if (noAttendance) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Clock className="h-10 w-10 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Harap Absensi Dulu</h2>
          <p className="text-muted-foreground">
            Anda harus melakukan Clock-In (Mulai Kerja) di menu Presensi agar sistem dapat merekap laporan shift Anda dengan benar.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/attendance">
            Ke Menu Presensi
          </Link>
        </Button>
      </div>
    );
  }

  if (noActiveReport) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-8">
        <div className="mx-auto w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center border-4 border-white shadow-xl">
           <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <ClipboardList className="h-8 w-8 text-primary" />
           </div>
        </div>
        
        <div className="space-y-3">
          <h2 className="text-2xl font-black tracking-tight text-foreground">Siap Memulai Shift?</h2>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider">
            {activeShiftInfo?.name} • {activeShiftInfo?.date}
          </div>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
            Sistem akan mencatat laporan digital, pengeluaran, dan rekap selisih untuk shift ini.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <Button 
            size="lg" 
            className="w-full h-14 text-base font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleCreateReport}
            disabled={isCreatingReport}
          >
            {isCreatingReport ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Menyiapkan Laporan...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" /> Buat Laporan {activeShiftInfo?.name}
              </span>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Laporan dibuat berdasarkan jam absensi kerja Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
            status === "Draft"
              ? "bg-muted text-muted-foreground border border-border"
              : status === "Submitted"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
          }`}>
            {status}
          </span>
          {autoSaving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-save-pulse font-medium">
              <Save className="h-3.5 w-3.5 text-primary" /> Menyimpan perubahan...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-foreground border border-border/60">
            📅 {todayDateStr}
          </span>
          {shiftType && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Shift {shiftType}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 1: Info Shift & Modal */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-primary/30">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border/50 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">1. Informasi Shift & Modal Awal</h2>
            <p className="text-xs text-muted-foreground">Pilih jadwal shift kasir dan masukkan uang modal fisik laci.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Tipe Shift</Label>
            <Select
              value={shiftType}
              onValueChange={(val) => setShiftType(val)}
              disabled={inputDisabled}
            >
              <SelectTrigger className="h-10 rounded-xl border-border/80 text-xs font-medium">
                <SelectValue placeholder="Pilih shift" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {availableShifts.map((s) => (
                  <SelectItem key={s.id} value={s.name} className="text-xs rounded-lg">
                    Shift {s.name} ({s.startTime} - {s.endTime})
                  </SelectItem>
                ))}
                {availableShifts.length === 0 && (
                  <>
                    <SelectItem value="Pagi" className="text-xs rounded-lg">Shift Pagi (07:00 - 15:00)</SelectItem>
                    <SelectItem value="Siang" className="text-xs rounded-lg">Shift Siang (15:00 - 23:00)</SelectItem>
                    <SelectItem value="Malam" className="text-xs rounded-lg">Shift Malam (23:00 - 07:00)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Modal Awal Laci (Rp)</Label>
            <Input
              type="number"
              value={startingCash || ""}
              onChange={(e) => setStartingCash(Number(e.target.value) || 0)}
              placeholder="500000"
              disabled={inputDisabled}
              className="h-10 rounded-xl border-border/80 text-xs font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Uang Tagihan Diterima (Rp)
            </Label>
            <Input
              type="number"
              value={billMoneyReceived || ""}
              onChange={(e) => setBillMoneyReceived(Number(e.target.value) || 0)}
              placeholder="0"
              disabled={inputDisabled}
              className="h-10 rounded-xl border-border/80 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Omzet POS */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-primary/30">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border/50 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-2xs">
            <Calculator className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">2. Omzet Mesin Kasir (POS)</h2>
            <p className="text-xs text-muted-foreground">Catat total penjualan tunai dan kartu debit/QRIS dari sistem POS.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Omzet POS Tunai (Rp)</Label>
            <Input
              type="number"
              value={posCash || ""}
              onChange={(e) => setPosCash(Number(e.target.value) || 0)}
              placeholder="0"
              disabled={inputDisabled}
              className="h-10 rounded-xl border-border/80 text-xs font-mono font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Omzet POS Non-Tunai / Debit (Rp)</Label>
            <Input
              type="number"
              value={posDebit || ""}
              onChange={(e) => setPosDebit(Number(e.target.value) || 0)}
              placeholder="0"
              disabled={inputDisabled}
              className="h-10 rounded-xl border-border/80 text-xs font-mono font-bold text-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Transaksi Digital */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-primary/30">
        <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 shadow-2xs">
              <Smartphone className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">3. Transaksi Digital</h2>
              <p className="text-xs text-muted-foreground">Transfer Bank, E-Wallet, Pulsa, PLN, dan PDAM via Flip.</p>
            </div>
          </div>
          {!inputDisabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={addDigitalRow}
              className="rounded-xl border-border/80 text-xs font-bold h-8.5 px-3 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Transaksi
            </Button>
          )}
        </div>

        {/* Flip Warning Banner (Dynamically checks entered Flip IDs) */}
        {(() => {
          const enteredFlipIds = new Set(
            digitalTx
              .map((tx) => (tx.flipId?.replace(/^#/, "") || "").trim().toUpperCase())
              .filter(Boolean)
          );
          const activeUnmatched = unmatchedFlips.filter(
            (f) => !enteredFlipIds.has((f.flipId?.replace(/^#/, "") || "").trim().toUpperCase())
          );

          if (activeUnmatched.length === 0) return null;

          return (
            <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-bold">Ada Transaksi Flip yang Belum Diinput</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ditemukan <b>{activeUnmatched.length} transaksi Flip</b> hari ini yang belum dimasukkan ke dalam tabel di bawah. Klik tombol <b>"+ Gunakan"</b> pada kartu di bawah untuk mengisinya secara instan:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeUnmatched.map((f) => (
                    <div
                      key={f.id || f.flipId}
                      className="inline-flex items-center gap-2 bg-background border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs shadow-2xs"
                    >
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        #{f.flipId?.replace(/^#/, "")}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium text-foreground">
                        {f.serviceType}: {formatCurrency(f.nominal)}
                      </span>
                      {f.customerName && (
                        <span className="text-muted-foreground text-[11px] truncate max-w-[120px]">
                          ({f.customerName})
                        </span>
                      )}
                      {!inputDisabled && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10px] font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300"
                          onClick={() => {
                            const cleanId = (f.flipId?.replace(/^#/, "") || "").trim();
                            const emptyIdx = digitalTx.findIndex(
                              (tx) => !tx.flipId && tx.grossAmount === 0
                            );
                            if (emptyIdx >= 0) {
                              updateDigitalTx(digitalTx[emptyIdx].id, "flipId", cleanId);
                              updateDigitalTx(digitalTx[emptyIdx].id, "grossAmount", f.nominal);
                              updateDigitalTx(digitalTx[emptyIdx].id, "serviceType", f.serviceType || "Transfer");
                              if (f.customerNumber || f.customerName) {
                                updateDigitalTx(digitalTx[emptyIdx].id, "detailContact", f.customerNumber || f.customerName);
                              }
                            } else {
                              setDigitalTx((prev) => [
                                ...prev,
                                {
                                  id: uid(),
                                  serviceType: f.serviceType || "Transfer",
                                  grossAmount: f.nominal,
                                  profitAmount: 0,
                                  detailContact: f.customerNumber || f.customerName || "",
                                  flipId: cleanId,
                                  isNonCash: false,
                                  paymentMethod: "",
                                },
                              ]);
                            }
                            toast.success(`Transaksi Flip #${cleanId} dimasukkan ke tabel`);
                          }}
                        >
                          + Gunakan
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {digitalTx.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-border/80 bg-muted/20">
            <p className="text-xs text-muted-foreground font-medium">
              Belum ada transaksi digital pada shift ini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {digitalTx.map((tx, idx) => {
              const isNewRow = !tx.createdBy;
              const isCreator = tx.createdBy === session?.user?.id;
              const isCashierRole = session?.user?.role === "cashier" || actingAsCashier;
              const isAdmin = session?.user?.role === "admin" || session?.user?.role === "super_admin";
              const canEdit = !inputDisabled && (isNewRow || isCreator || isCashierRole || isAdmin);
              const canDelete = !inputDisabled && (isNewRow || isCreator || actingAsCashier || isAdmin);

              return (
                <div key={tx.id} className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs transition-all hover:border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={() => removeDigitalRow(tx.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Jenis</Label>
                      <Select
                        value={tx.serviceType}
                        onValueChange={(v) => updateDigitalTx(tx.id, "serviceType", v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl border-border/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Transfer">Transfer</SelectItem>
                          <SelectItem value="Top Up E-Walet">Top Up E-Walet</SelectItem>
                          <SelectItem value="Pulsa/Paket Data">Pulsa/Paket Data</SelectItem>
                          <SelectItem value="Listrik">Listrik</SelectItem>
                          <SelectItem value="PDAM">PDAM</SelectItem>
                          <SelectItem value="Indihome">Indihome</SelectItem>
                          <SelectItem value="Lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Nominal (Gross)</Label>
                      <Input
                        type="number"
                        value={tx.grossAmount || ""}
                        onChange={(e) => updateDigitalTx(tx.id, "grossAmount", Number(e.target.value))}
                        disabled={!canEdit}
                        className="h-9 text-xs font-mono font-bold rounded-xl border-border/80"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Laba / Fee Admin</Label>
                      <Input
                        type="number"
                        value={tx.profitAmount || ""}
                        onChange={(e) => updateDigitalTx(tx.id, "profitAmount", Number(e.target.value))}
                        disabled={!canEdit}
                        className="h-9 text-xs font-mono font-bold text-emerald-600 rounded-xl border-border/80"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Detail / Kontak</Label>
                      <Input
                        value={tx.detailContact}
                        onChange={(e) => updateDigitalTx(tx.id, "detailContact", e.target.value)}
                        disabled={!canEdit}
                        className="h-9 text-xs rounded-xl border-border/80"
                        placeholder="No HP / Rekening"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">ID Flip</Label>
                      <Input
                        value={tx.flipId}
                        onChange={(e) => updateDigitalTx(tx.id, "flipId", e.target.value)}
                        disabled={!canEdit}
                        className="h-9 text-xs font-mono rounded-xl border-border/80"
                        placeholder="#FTxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Metode Bayar</Label>
                      <Select
                        value={tx.isNonCash ? (tx.paymentMethod || "Debit") : "Tunai"}
                        onValueChange={(v) => {
                          if (v === "Tunai") {
                            updateDigitalTx(tx.id, "isNonCash", false);
                            updateDigitalTx(tx.id, "paymentMethod", "");
                          } else {
                            updateDigitalTx(tx.id, "isNonCash", true);
                            updateDigitalTx(tx.id, "paymentMethod", v);
                          }
                        }}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl border-border/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Tunai">💵 Tunai (Kasir)</SelectItem>
                          <SelectItem value="Debit">💳 Non-Tunai / Debit</SelectItem>
                          <SelectItem value="QRIS">📱 QRIS Toko</SelectItem>
                          <SelectItem value="Transfer Bank">🏦 Transfer Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4: Pengeluaran Toko & Supplier */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-primary/30">
        <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 shadow-2xs">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">4. Pengeluaran Toko & Supplier</h2>
              <p className="text-xs text-muted-foreground">Pembayaran nota supplier dari Uang Tagihan, Uang Kasir, atau Transfer.</p>
            </div>
          </div>
          {!inputDisabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={addExpenditure}
              className="rounded-xl border-border/80 text-xs font-bold h-8.5 px-3 hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Pengeluaran
            </Button>
          )}
        </div>

        {expenditures.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-border/80 bg-muted/20">
            <p className="text-xs text-muted-foreground font-medium">
              Belum ada pengeluaran yang dicatat pada shift ini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {expenditures.map((ex, idx) => {
              const exTotal = ex.amountFromBill + ex.amountFromCashier + ex.amountFromTransfer;
              const isNewRow = !ex.createdBy;
              const isCreator = ex.createdBy === session?.user?.id;
              const isCashierRole = session?.user?.role === "cashier" || actingAsCashier;
              const isAdmin = session?.user?.role === "admin" || session?.user?.role === "super_admin";
              const canEdit = !inputDisabled && (isNewRow || isCreator || isCashierRole || isAdmin);
              const canDelete = !inputDisabled && (isNewRow || isCreator || actingAsCashier || isAdmin);

              return (
                <div key={ex.id} className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs transition-all hover:border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {exTotal > 0 && (
                        <span className="text-xs font-mono font-bold text-foreground">
                          Total: {formatCurrency(exTotal)}
                        </span>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => removeExpenditure(ex.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Row 1: Supplier */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Supplier</Label>
                      <Input
                        value={ex.supplierName}
                        onChange={(e) => updateExpenditure(ex.id, "supplierName", e.target.value)}
                        disabled={!canEdit}
                        className="h-9 text-xs rounded-xl border-border/80"
                        placeholder="Nama supplier"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-foreground">Foto Nota</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 text-xs rounded-xl border-border/80"
                        disabled={!canEdit}
                      >
                        <UploadCloud className="mr-1 h-3.5 w-3.5" />
                        Upload
                      </Button>
                    </div>
                  </div>

                  {/* Row 2: 3 Payment Sources */}
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5 space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Sumber Pembayaran (isi sesuai yang digunakan)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold flex items-center gap-1">
                          <Wallet className="h-3 w-3 text-amber-500" />
                          Uang Tagihan (Rp)
                        </Label>
                        <Input
                          type="number"
                          value={ex.amountFromBill || ""}
                          onChange={(e) => updateExpenditure(ex.id, "amountFromBill", Number(e.target.value))}
                          disabled={!canEdit}
                          className="h-9 text-xs font-mono font-bold rounded-xl border-border/80"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-blue-500" />
                          Uang Kasir (Rp)
                        </Label>
                        <Input
                          type="number"
                          value={ex.amountFromCashier || ""}
                          onChange={(e) => updateExpenditure(ex.id, "amountFromCashier", Number(e.target.value))}
                          disabled={!canEdit}
                          className="h-9 text-xs font-mono font-bold text-destructive rounded-xl border-border/80"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold flex items-center gap-1">
                          <Send className="h-3 w-3 text-emerald-500" />
                          Transfer Toko (Rp)
                        </Label>
                        <Input
                          type="number"
                          value={ex.amountFromTransfer || ""}
                          onChange={(e) => updateExpenditure(ex.id, "amountFromTransfer", Number(e.target.value))}
                          disabled={!canEdit}
                          className="h-9 text-xs font-mono font-bold text-emerald-600 rounded-xl border-border/80"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 5: Rekap & Live Selisih Kas */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border/50 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
            <Calculator className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">5. Rekapitulasi & Hitung Fisik Kas</h2>
            <p className="text-xs text-muted-foreground">Bandingkan jumlah fisik uang di laci dengan hasil kalkulasi sistem.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Calculation breakdown Upwork Ledger */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Modal Awal Kas</span>
              <span className="font-mono font-bold">{formatCurrency(startingCash)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">+ POS Tunai</span>
              <span className="font-mono font-bold">{formatCurrency(posCash)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">+ Layanan Digital (Tunai)</span>
              <span className="font-mono font-bold">{formatCurrency(digitalCashIn)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">− Pengeluaran (Uang Kasir)</span>
              <span className="font-mono font-bold text-destructive">−{formatCurrency(expFromCashier)}</span>
            </div>
            <Separator className="my-1 border-border/60" />
            <div className="flex justify-between font-bold text-sm text-foreground">
              <span>Total Cash Seharusnya</span>
              <span className="font-mono text-lg text-primary">{formatCurrency(expectedCash)}</span>
            </div>
          </div>

          {/* Bill Money Breakdown if any */}
          {(billMoneyReceived > 0 || expFromBill > 0) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground mb-1">
                <span>📋 Rekap Uang Tagihan Kasir</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uang Tagihan Diterima</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{formatCurrency(billMoneyReceived)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Dipakai untuk Bayar Nota Tagihan</span>
                <span className="font-mono font-bold text-destructive">−{formatCurrency(expFromBill)}</span>
              </div>
              <Separator className="my-1 border-amber-500/20" />
              <div className="flex justify-between font-bold text-foreground">
                <span>Sisa Uang Tagihan (Terpisah dari Laci)</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{formatCurrency(sisaUangTagihan)}</span>
              </div>
            </div>
          )}

          {/* Manual count input */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-count" className="text-xs font-bold text-foreground">
              Total Cash Hitung Manual Fisik Laci (Rp)
            </Label>
            <Input
              id="manual-count"
              type="number"
              value={manualCashCount || ""}
              onChange={(e) => setManualCashCount(Number(e.target.value))}
              disabled={inputDisabled}
              className="h-12 text-lg font-mono font-black rounded-xl border-border/80"
              placeholder="Masukkan total uang fisik kasir..."
            />
          </div>

          {/* Variance indicator */}
          {manualCashCount > 0 && (
            <div
              className={`flex items-center gap-3 rounded-2xl p-4 border transition-all ${
                variance === 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : variance > 0
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {variance === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className={`h-5 w-5 shrink-0 ${variance > 0 ? "text-blue-600" : "text-destructive"}`} />
              )}
              <div>
                <p className="text-sm font-bold">
                  {variance === 0
                    ? "Pas! Tidak ada selisih uang kasir 🎉"
                    : `Selisih: ${variance > 0 ? "+" : ""}${formatCurrency(variance)}`}
                </p>
                <p className="text-xs opacity-85 mt-0.5">
                  {variance > 0
                    ? "Fisik uang kasir lebih dari kalkulasi sistem."
                    : variance < 0
                    ? "Fisik uang kasir kurang dari kalkulasi sistem."
                    : "Hitung fisik laci 100% cocok dengan laporan sistem."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {status !== "Submitted" && (
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl px-6 font-bold h-11 border-border/80 bg-card hover:bg-muted"
            onClick={() => handleSave()}
          >
            <Save className="mr-2 h-4 w-4" />
            Simpan Draft
          </Button>
          <Button
            size="lg"
            className="rounded-xl px-8 font-bold h-11 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={() => handleSubmit()}
          >
            <Send className="mr-2 h-4 w-4" />
            Kirim Laporan Shift
          </Button>
        </div>
      )}

      {status === "Submitted" && !isRevising && (
        <div className="flex flex-col items-center gap-4 mt-8">
            <div className="flex items-center justify-center gap-2 w-full rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Laporan telah di-submit. Menunggu verifikasi Admin.
                </p>
            </div>
            <Button 
                variant="outline" 
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => setIsRevising(true)}
            >
                <FileEdit className="mr-2 h-4 w-4" />
                Revisi Laporan
            </Button>
        </div>
      )}

      {isRevising && (
          <Card className="border-amber-200 bg-amber-50/30 mt-8">
              <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="revision-reason" className="text-amber-800 font-medium">Alasan Revisi (Wajib)</Label>
                      <Textarea 
                          id="revision-reason"
                          placeholder="Jelaskan bagian mana yang diubah dan alasannya..."
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className="bg-white"
                      />
                  </div>
                  <div className="flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => {
                          setIsRevising(false);
                          setEditReason("");
                      }}>
                          Batal
                      </Button>
                      <Button 
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={!editReason.trim()}
                        onClick={() => handleSave()}
                      >
                          Simpan Revisi
                      </Button>
                  </div>
              </CardContent>
          </Card>
      )}

      <div className="h-20" /> {/* Spacer */}
    </div>
  );
}
