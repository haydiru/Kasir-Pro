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

  // Flip warning check (isolated mock data)
  const unmatchedFlips: any[] = [];

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
      <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
        <div className="flex items-center gap-3">
          <Badge className={status === "Draft" ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-600"}>
            {status}
          </Badge>
          {autoSaving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-save-pulse">
              <Save className="h-3 w-3" /> Menyimpan draft...
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {todayDateStr} • {shiftType}
        </span>
      </div>

      {/* Flip Warning */}
      {unmatchedFlips.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {unmatchedFlips.length} transaksi Flip belum tercatat!
            </p>
            <ul className="mt-1 space-y-0.5">
              {unmatchedFlips.map((f) => (
                <li key={f.flipId} className="text-xs text-muted-foreground">
                  {f.flipId} — {formatCurrency(f.nominal)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* SECTION 1: Info Shift & Modal */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Info Shift & Modal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Kasir</Label>
              <Input value={reportOwnerName || session?.user?.name || "Kasir"} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Shift</Label>
              <Select
                value={shiftType}
                onValueChange={(v) => setShiftType(v)}
                disabled={inputDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Shift" />
                </SelectTrigger>
                <SelectContent>
                  {availableShifts.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name} ({s.startTime}-{s.endTime})
                      </SelectItem>
                  ))}
                  {/* Fallback if current shift is not in available (e.g. settings changed) */}
                  {shiftType && !availableShifts.find(s => s.name === shiftType) && (
                      <SelectItem value={shiftType}>{shiftType}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="starting-cash" className="text-xs text-muted-foreground">
                Modal Awal Laci (Rp)
              </Label>
              <Input
                id="starting-cash"
                type="number"
                value={startingCash}
                onChange={(e) => setStartingCash(Number(e.target.value))}
                disabled={inputDisabled}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-money" className="text-xs text-muted-foreground">
                Uang Tagihan Masuk (Rp)
              </Label>
              <Input
                id="bill-money"
                type="number"
                value={billMoneyReceived || ""}
                onChange={(e) => setBillMoneyReceived(Number(e.target.value))}
                disabled={inputDisabled}
                className="font-mono"
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground">
                Uang tagihan yang diterima, direkap terpisah dari modal kasir
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: POS */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Data POS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pos-cash" className="text-xs text-muted-foreground">
                Penghasilan Tunai POS (Rp)
              </Label>
              <Input
                id="pos-cash"
                type="number"
                value={posCash || ""}
                onChange={(e) => setPosCash(Number(e.target.value))}
                placeholder="0"
                disabled={inputDisabled}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-debit" className="text-xs text-muted-foreground">
                Penghasilan Debit POS (Rp)
              </Label>
              <Input
                id="pos-debit"
                type="number"
                value={posDebit || ""}
                onChange={(e) => setPosDebit(Number(e.target.value))}
                placeholder="0"
                disabled={inputDisabled}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Layanan Digital */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Layanan Digital
            </CardTitle>
            {!inputDisabled && (
              <Button variant="outline" size="sm" onClick={addDigitalRow}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Baris
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {digitalTx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Belum ada transaksi digital
            </p>
          ) : (
            <div className="space-y-3">
              {digitalTx.map((tx, idx) => {
                const isNewRow = !tx.createdBy; // Just created in this session, not yet saved
                const isCreator = tx.createdBy === session?.user?.id;
                const isCashierRole = session?.user?.role === "cashier" || actingAsCashier;
                const canEdit = !inputDisabled && (isNewRow || isCreator || isCashierRole);
                const canDelete = !inputDisabled && (isNewRow || isCreator || actingAsCashier);

                return (
                  <div key={tx.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{idx + 1}
                      </span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDigitalRow(tx.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Jenis</Label>
                      <Select
                        value={tx.serviceType}
                        onValueChange={(v) => updateDigitalTx(tx.id, "serviceType", v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                      <Label className="text-[11px]">Modal+Laba (Rp)</Label>
                      <Input
                        type="number"
                        value={tx.grossAmount || ""}
                        onChange={(e) => updateDigitalTx(tx.id, "grossAmount", Number(e.target.value))}
                        disabled={!canEdit}
                        className="h-9 text-xs font-mono"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Laba (Rp)</Label>
                      <Input
                        type="number"
                        value={tx.profitAmount || ""}
                        onChange={(e) => updateDigitalTx(tx.id, "profitAmount", Number(e.target.value))}
                        disabled={!canEdit}
                        className="h-9 text-xs font-mono"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[11px]">Detail / Kontak</Label>
                      <Input
                        value={tx.detailContact}
                        onChange={(e) => updateDigitalTx(tx.id, "detailContact", e.target.value)}
                        disabled={!canEdit}
                        className="h-9 text-xs"
                        placeholder="No Hp / No Rekening / ID Pelanggan"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">ID Flip</Label>
                      <Input
                        value={tx.flipId}
                        onChange={(e) => updateDigitalTx(tx.id, "flipId", e.target.value)}
                        disabled={!canEdit}
                        className="h-9 text-xs font-mono"
                        placeholder="#FT783824726"
                      />
                    </div>
                  </div>
                  {/* Non-Cash toggle */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tx.isNonCash}
                        onChange={(e) => updateDigitalTx(tx.id, "isNonCash", e.target.checked)}
                        disabled={!canEdit}
                        className="rounded border-input"
                      />
                      Non-Tunai
                    </label>
                    {tx.isNonCash && (
                      <Select
                        value={tx.paymentMethod}
                        onValueChange={(v) => updateDigitalTx(tx.id, "paymentMethod", v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="Metode..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QRIS">QRIS</SelectItem>
                          <SelectItem value="Debit BCA">Debit BCA</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {/* Creator & Updater Tags */}
                    <div className="ml-auto flex flex-wrap gap-2">
                        {tx.createdByName && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/50 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground border">
                            <UserSquare2 className="h-3 w-3" />
                            Dibuat: {tx.createdByName}
                        </div>
                        )}
                        {tx.updatedByName && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-200">
                            <FileEdit className="h-3 w-3" />
                            Diedit: {tx.updatedByName}
                        </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </CardContent>
      </Card>

      {/* SECTION 4: Pengeluaran */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Pengeluaran
            </CardTitle>
            {!inputDisabled && (
              <Button variant="outline" size="sm" onClick={addExpenditure}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {expenditures.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Belum ada pengeluaran
            </p>
          ) : (
            <div className="space-y-4">
              {expenditures.map((ex, idx) => {
                const exTotal = ex.amountFromBill + ex.amountFromCashier + ex.amountFromTransfer;
                const isNewRow = !ex.createdBy; // Just created in this session, not yet saved
                const isCreator = ex.createdBy === session?.user?.id;
                const isCashierRole = session?.user?.role === "cashier" || actingAsCashier;
                const canEdit = !inputDisabled && (isNewRow || isCreator || isCashierRole);
                const canDelete = !inputDisabled && (isNewRow || isCreator || actingAsCashier);

                return (
                  <div key={ex.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {exTotal > 0 && (
                          <span className="text-xs font-mono text-muted-foreground">
                            Total: {formatCurrency(exTotal)}
                          </span>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeExpenditure(ex.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Row 1: Supplier + Upload */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-[11px]">Supplier</Label>
                        <Input
                          value={ex.supplierName}
                          onChange={(e) => updateExpenditure(ex.id, "supplierName", e.target.value)}
                          disabled={!canEdit}
                          className="h-9 text-xs"
                          placeholder="Nama supplier"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Foto Nota</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs"
                          disabled={!canEdit}
                        >
                          <UploadCloud className="mr-1 h-3 w-3" />
                          Upload
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: 3 Payment Sources */}
                    <div className="rounded-md border border-dashed p-3 space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Sumber Pembayaran (isi yang dipakai)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] flex items-center gap-1">
                            <Wallet className="h-3 w-3 text-amber-500" />
                            Uang Tagihan (Rp)
                          </Label>
                          <Input
                            type="number"
                            value={ex.amountFromBill || ""}
                            onChange={(e) => updateExpenditure(ex.id, "amountFromBill", Number(e.target.value))}
                            disabled={!canEdit}
                            className="h-9 text-xs font-mono"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] flex items-center gap-1">
                            <CreditCard className="h-3 w-3 text-blue-500" />
                            Uang Kasir (Rp)
                          </Label>
                          <Input
                            type="number"
                            value={ex.amountFromCashier || ""}
                            onChange={(e) => updateExpenditure(ex.id, "amountFromCashier", Number(e.target.value))}
                            disabled={!canEdit}
                            className="h-9 text-xs font-mono"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] flex items-center gap-1">
                            <Send className="h-3 w-3 text-emerald-500" />
                            Transfer (Rp)
                          </Label>
                          <Input
                            type="number"
                            value={ex.amountFromTransfer || ""}
                            onChange={(e) => updateExpenditure(ex.id, "amountFromTransfer", Number(e.target.value))}
                            disabled={!canEdit}
                            className="h-9 text-xs font-mono"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                        {ex.createdByName && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/50 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground border">
                            <UserSquare2 className="h-3 w-3" />
                            Dibuat: {ex.createdByName}
                        </div>
                        )}
                        {ex.updatedByName && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-200">
                            <FileEdit className="h-3 w-3" />
                            Diedit: {ex.updatedByName}
                        </div>
                        )}
                    </div>
                  </div>
                );
              })}

              {/* Expenditure Summary */}
              {expenditures.length > 0 && totalExpenditure > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
                  <p className="font-medium text-muted-foreground uppercase tracking-wider mb-2">Ringkasan Pengeluaran</p>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Wallet className="h-3 w-3 text-amber-500" /> Dari Uang Tagihan
                    </span>
                    <span className="font-mono">{formatCurrency(expFromBill)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CreditCard className="h-3 w-3 text-blue-500" /> Dari Uang Kasir
                    </span>
                    <span className="font-mono text-destructive">{formatCurrency(expFromCashier)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Send className="h-3 w-3 text-emerald-500" /> Via Transfer
                    </span>
                    <span className="font-mono">{formatCurrency(expFromTransfer)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-medium">
                    <span>Total Pengeluaran</span>
                    <span className="font-mono">{formatCurrency(totalExpenditure)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 5: Rekap & Selisih */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Rekap & Selisih
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Calculation breakdown */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modal Awal</span>
                <span className="font-mono">{formatCurrency(startingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ POS Tunai</span>
                <span className="font-mono">{formatCurrency(posCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ Layanan Digital (Tunai)</span>
                <span className="font-mono">{formatCurrency(digitalCashIn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Pengeluaran (Uang Kasir)</span>
                <span className="font-mono text-destructive">−{formatCurrency(expFromCashier)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Cash Seharusnya</span>
                <span className="font-mono text-lg">{formatCurrency(expectedCash)}</span>
              </div>
            </div>

            {/* Sisa Uang Tagihan */}
            {(billMoneyReceived > 0 || expFromBill > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5 p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  📋 Rekap Uang Tagihan
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uang Tagihan Masuk</span>
                  <span className="font-mono">{formatCurrency(billMoneyReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">− Dipakai untuk Pengeluaran</span>
                  <span className="font-mono text-destructive">−{formatCurrency(expFromBill)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Sisa Uang Tagihan</span>
                  <span className={`font-mono text-lg ${sisaUangTagihan < 0 ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                    {formatCurrency(sisaUangTagihan)}
                  </span>
                </div>
              </div>
            )}

            {/* Expenditure summary in recap (if transfer exists) */}
            {expFromTransfer > 0 && (
              <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <span className="font-medium">ℹ️ Pengeluaran via Transfer:</span>{" "}
                {formatCurrency(expFromTransfer)}{" "}
                <span className="italic">(tidak mempengaruhi rekap cash)</span>
              </div>
            )}

            {/* Manual count input */}
            <div className="space-y-2">
              <Label htmlFor="manual-count" className="font-medium">
                Total Cash Hitung Manual (Rp)
              </Label>
              <Input
                id="manual-count"
                type="number"
                value={manualCashCount || ""}
                onChange={(e) => setManualCashCount(Number(e.target.value))}
                disabled={inputDisabled}
                className="h-12 text-lg font-mono font-semibold"
                placeholder="Masukkan jumlah uang setelah dihitung..."
              />
            </div>

            {/* Variance indicator */}
            {manualCashCount > 0 && (
              <div
                className={`flex items-center gap-3 rounded-lg p-4 ${
                  variance === 0
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : variance > 0
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : "bg-destructive/10 border border-destructive/30"
                }`}
              >
                {variance === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className={`h-5 w-5 ${variance > 0 ? "text-blue-500" : "text-destructive"}`} />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {variance === 0
                      ? "Pas! Tidak ada selisih 🎉"
                      : `Selisih: ${variance > 0 ? "+" : ""}${formatCurrency(variance)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {variance > 0
                      ? "Uang lebih dari yang seharusnya"
                      : variance < 0
                      ? "Uang kurang dari yang seharusnya"
                      : "Hitung manual sesuai dengan perhitungan sistem"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {status !== "Submitted" && (
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
          <Button
            size="lg"
            variant="outline"
            className="px-6"
            onClick={() => handleSave()}
          >
            <Save className="mr-2 h-4 w-4" />
            Simpan
          </Button>
          <Button
            size="lg"
            className="px-8"
            onClick={handleSubmit}
            disabled={manualCashCount === 0}
          >
            <Send className="mr-2 h-4 w-4" />
            Submit Laporan
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
