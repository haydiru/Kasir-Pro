"use client";

import { useState, useMemo, useTransition, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Loader2,
  Search,
  Filter,
  DollarSign,
  Undo,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatCurrency, formatFullLocalDate, formatLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import { createBill, updateBillStatus, deleteBill, rescheduleBill } from "@/app/actions/bill";
import { getActiveCashierReports } from "@/app/actions/report";
import SupplierCombobox from "@/components/supplier-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BillItem {
  id: string;
  supplierName: string;
  dueDate: string; // ISO date string from server
  amount: number;
  status: string; // 'BELUM_BAYAR' | 'LUNAS'
  calendarEventId: string | null;
  createdById: string | null;
  createdAt: string;
  createdBy?: { name: string } | null;
}

interface PendingReturnItem {
  id: string;
  supplierName: string;
  productName: string;
  quantity: number;
  reason: string | null;
  status: string;
}

interface Props {
  initialBills: BillItem[];
  initialPendingReturns?: PendingReturnItem[];
  timezone: string;
  isGoogleConnected: boolean;
}

export default function BillsClient({ initialBills, initialPendingReturns = [], timezone, isGoogleConnected }: Props) {
  const [bills, setBills] = useState<BillItem[]>(initialBills);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"SEMUA" | "BELUM_BAYAR" | "LUNAS">("BELUM_BAYAR");
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentSourceDialogOpen, setPaymentSourceDialogOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  // View state & Calendar states
  const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Rescheduling states
  const [reschedulingBillId, setReschedulingBillId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [isRescheduleLoading, setIsRescheduleLoading] = useState(false);

  // Active cashier reports for bill payment targeting
  const [activeReports, setActiveReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  const loadActiveReports = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const res = await getActiveCashierReports();
      if (res.success && res.data) {
        setActiveReports(res.data);
        if (res.data.length === 1) {
          setSelectedReportId(res.data[0].id);
        } else {
          setSelectedReportId("");
        }
      }
    } catch {
      // silent – will show warning in dialog
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  // Payment input states
  const [payCashier, setPayCashier] = useState("");
  const [payBill, setPayBill] = useState("");
  const [payTransfer, setPayTransfer] = useState("");

  const selectedBill = useMemo(() => {
    return initialBills.find((b) => b.id === selectedBillId);
  }, [initialBills, selectedBillId]);

  const totalAllocated = useMemo(() => {
    return (Number(payCashier) || 0) + (Number(payBill) || 0) + (Number(payTransfer) || 0);
  }, [payCashier, payBill, payTransfer]);

  const isAllocationValid = useMemo(() => {
    if (!selectedBill) return false;
    const cashierVal = Number(payCashier) || 0;
    const billVal = Number(payBill) || 0;
    const transferVal = Number(payTransfer) || 0;
    if (cashierVal < 0 || billVal < 0 || transferVal < 0) return false;
    return Math.abs(totalAllocated - selectedBill.amount) < 0.01;
  }, [selectedBill, payCashier, payBill, payTransfer, totalAllocated]);

  useEffect(() => {
    if (paymentSourceDialogOpen && selectedBill) {
      setPayCashier(selectedBill.amount.toString());
      setPayBill("");
      setPayTransfer("");
      loadActiveReports();
    }
  }, [paymentSourceDialogOpen, selectedBill, loadActiveReports]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Individual loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Helper: Format tanggal lokal untuk pembandingan
  function getLocalDateString(dateInput: Date | string) {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  // Ringkasan Tagihan (Hari Ini, Besok, Minggu Ini)
  const stats = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrowDate);

    // List tanggal 7 hari ke depan
    const next7DaysStr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      next7DaysStr.push(getLocalDateString(d));
    }

    let todayTotal = 0;
    let tomorrowTotal = 0;
    let weekTotal = 0;

    initialBills.forEach((bill) => {
      if (bill.status !== "BELUM_BAYAR") return;
      const billDateStr = getLocalDateString(bill.dueDate);

      if (billDateStr === todayStr) {
        todayTotal += bill.amount;
      }
      if (billDateStr === tomorrowStr) {
        tomorrowTotal += bill.amount;
      }
      if (next7DaysStr.includes(billDateStr)) {
        weekTotal += bill.amount;
      }
    });

    return { todayTotal, tomorrowTotal, weekTotal };
  }, [initialBills, timezone]);

  // Form Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error("Nama supplier harus diisi");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Nominal harus lebih besar dari 0");
      return;
    }
    if (!dueDate) {
      toast.error("Tanggal jatuh tempo harus diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBill({
        supplierName,
        supplierId: supplierId || undefined,
        dueDate: new Date(dueDate).toISOString(),
        amount: Number(amount),
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Tagihan berhasil disimpan!");
        setSupplierName("");
        setSupplierId("");
        setAmount("");
        setDueDate("");
        setIsDialogOpen(false);
        // Page akan di-revalidate oleh server action, jadi data baru akan mengalir ke initialBills
      }
    } catch {
      toast.error("Terjadi kesalahan teknis.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Update Status Handler
  async function handleToggleStatus(id: string, currentStatus: string) {
    if (currentStatus === "BELUM_BAYAR") {
      setSelectedBillId(id);
      setPaymentSourceDialogOpen(true);
    } else {
      setActionLoadingId(id);
      try {
        const res = await updateBillStatus(id, "BELUM_BAYAR");
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(res.success || "Status tagihan diperbarui");
        }
      } catch {
        toast.error("Gagal memperbarui status");
      } finally {
        setActionLoadingId(null);
      }
    }
  }

  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBillId || !selectedBill || !isAllocationValid) return;
    if (!selectedReportId) {
      toast.error("Pilih laporan shift kasir tujuan terlebih dahulu.");
      return;
    }
    const id = selectedBillId;
    setPaymentSourceDialogOpen(false);
    setActionLoadingId(id);
    try {
      const res = await updateBillStatus(id, "LUNAS", {
        cashier: Number(payCashier) || 0,
        bill: Number(payBill) || 0,
        transfer: Number(payTransfer) || 0,
      }, selectedReportId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Tagihan berhasil dilunasi!");
      }
    } catch {
      toast.error("Gagal melunasi tagihan");
    } finally {
      setActionLoadingId(null);
      setSelectedBillId(null);
    }
  }

  const MONTHS_ID = useMemo(() => [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ], []);

  function formatCompactCurrency(val: number) {
    if (val === 0) return "Rp 0";
    if (val < 1000) return `Rp ${val}`;
    if (val < 1000000) {
      const rb = val / 1000;
      return `Rp ${rb.toFixed(0)}rb`;
    }
    const jt = val / 1000000;
    return `Rp ${jt.toFixed(jt % 1 === 0 ? 0 : 1)}jt`;
  }

  async function handleRescheduleBill(billId: string) {
    if (!rescheduleDate) return;
    setIsRescheduleLoading(true);
    try {
      const res = await rescheduleBill(billId, new Date(rescheduleDate).toISOString());
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Tanggal jatuh tempo berhasil diubah!");
        setReschedulingBillId(null);
        setRescheduleDate("");
      }
    } catch {
      toast.error("Gagal menjadwalkan ulang tagihan.");
    } finally {
      setIsRescheduleLoading(false);
    }
  }

  // Delete Handler
  async function handleDeleteBill(id: string) {
    if (!confirm("Hapus tagihan supplier ini secara permanen?")) return;
    
    setActionLoadingId(id);
    try {
      const res = await deleteBill(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Tagihan berhasil dihapus");
      }
    } catch {
      toast.error("Gagal menghapus tagihan");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Filter bills based on search and status tabs
  const filteredBills = useMemo(() => {
    return initialBills.filter((bill) => {
      const matchesSearch = bill.supplierName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "SEMUA" || bill.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [initialBills, searchQuery, statusFilter]);

  // Pre-aggregate bills by due date for calendar view
  const billsByDate = useMemo(() => {
    const agg: Record<string, { count: number; totalAmount: number; unpaidTotal: number; bills: BillItem[] }> = {};
    
    filteredBills.forEach((bill) => {
      const dateStr = getLocalDateString(bill.dueDate);
      if (!agg[dateStr]) {
        agg[dateStr] = { count: 0, totalAmount: 0, unpaidTotal: 0, bills: [] };
      }
      agg[dateStr].count += 1;
      agg[dateStr].totalAmount += bill.amount;
      if (bill.status === "BELUM_BAYAR") {
        agg[dateStr].unpaidTotal += bill.amount;
      }
      agg[dateStr].bills.push(bill);
    });
    
    return agg;
  }, [filteredBills, timezone]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const gridDays = useMemo(() => {
    const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
    const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonthIndex);
    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({ date: new Date(prevYear, prevMonthIndex, d), isCurrentMonth: false, key: `prev-${d}` });
    }
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({ date: new Date(currentYear, currentMonth, i), isCurrentMonth: true, key: `curr-${i}` });
    }
    const remainingDays = 42 - days.length;
    const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(nextYear, nextMonthIndex, i), isCurrentMonth: false, key: `next-${i}` });
    }
    return days;
  }, [currentYear, currentMonth]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Tagihan Supplier
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
            {isGoogleConnected ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold gap-1 text-[10px] py-0 h-5">
                <CheckCircle2 className="h-3 w-3" />
                Google Calendar Sinkron
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[10px] py-0 h-5 font-bold">
                Calendar Belum Terhubung
              </Badge>
            )}
          </p>
        </div>

        <Button
          onClick={() => setIsDialogOpen(true)}
          className="rounded-xl font-bold gap-2 py-5.5 px-5 shadow-lg shadow-primary/10"
        >
          <Plus className="h-4.5 w-4.5" />
          Catat Tagihan Baru
        </Button>
      </div>

      {/* Visual summaries (Hari Ini, Besok, Minggu Ini) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Hari Ini */}
        <Card className="border-0 border-l-4 border-l-rose-500 shadow-sm bg-rose-500/[0.03] dark:bg-rose-950/[0.05] border border-rose-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Jatuh Tempo Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
              {formatCurrency(stats.todayTotal)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Tagihan belum lunas hari ini
            </p>
          </CardContent>
        </Card>

        {/* Besok */}
        <Card className="border-0 border-l-4 border-l-amber-500 shadow-sm bg-amber-500/[0.03] dark:bg-amber-950/[0.05] border border-amber-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Jatuh Tempo Besok
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {formatCurrency(stats.tomorrowTotal)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Tagihan belum lunas besok pagi
            </p>
          </CardContent>
        </Card>

        {/* Minggu Ini */}
        <Card className="border-0 border-l-4 border-l-indigo-500 shadow-sm bg-indigo-500/[0.03] dark:bg-indigo-950/[0.05] border border-indigo-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Jatuh Tempo 7 Hari Ke Depan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {formatCurrency(stats.weekTotal)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Total estimasi pengeluaran mingguan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-card p-3 rounded-2xl border border-muted-foreground/10">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-card border-muted-foreground/10 text-sm"
            />
          </div>

          <div className="flex gap-1 p-1 bg-muted/60 rounded-xl w-fit self-start">
            <Button
              variant={statusFilter === "BELUM_BAYAR" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("BELUM_BAYAR")}
              className="h-8 text-xs font-bold rounded-lg"
            >
              Belum Lunas
            </Button>
            <Button
              variant={statusFilter === "LUNAS" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("LUNAS")}
              className="h-8 text-xs font-bold rounded-lg"
            >
              Lunas
            </Button>
            <Button
              variant={statusFilter === "SEMUA" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("SEMUA")}
              className="h-8 text-xs font-bold rounded-lg"
            >
              Semua
            </Button>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex gap-1.5 p-1 bg-primary/5 border border-primary/10 rounded-xl w-fit shrink-0 self-start md:self-auto">
          <Button
            type="button"
            variant={viewMode === "LIST" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("LIST")}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Tampilan Daftar
          </Button>
          <Button
            type="button"
            variant={viewMode === "CALENDAR" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("CALENDAR")}
        className="h-8 text-xs font-bold rounded-lg"
      >
        Tampilan Kalender
      </Button>
    </div>
  </div>

  {viewMode === "CALENDAR" ? (
    <div className="space-y-6">
      {/* Calendar Header Card */}
      <Card className="border-0 shadow-sm bg-card border border-muted-foreground/10">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear(currentYear - 1);
                  } else {
                    setCurrentMonth(currentMonth - 1);
                  }
                }}
                className="h-8 w-8 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm sm:text-base font-bold text-foreground min-w-32 text-center capitalize">
                {MONTHS_ID[currentMonth]} {currentYear}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear(currentYear + 1);
                  } else {
                    setCurrentMonth(currentMonth + 1);
                  }
                }}
                className="h-8 w-8 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentYear(new Date().getFullYear());
                setCurrentMonth(new Date().getMonth());
              }}
              className="text-xs h-8 rounded-lg font-bold"
            >
              Bulan Ini
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Day of Week Headers */}
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <div
                key={day}
                className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {gridDays.map(({ date, isCurrentMonth, key }) => {
              const dateStr = getLocalDateString(date);
              const data = billsByDate[dateStr];
              const dayNum = date.getDate();
              const isToday = getLocalDateString(new Date()) === dateStr;

              let cellBg = "bg-muted/10";
              let borderStyle = "border border-muted-foreground/5";
              let textStyle = isCurrentMonth ? "text-foreground font-semibold" : "text-muted-foreground/35";
              let heatColor = "";

              if (isToday) {
                borderStyle = "border-2 border-primary shadow-sm";
              }

              if (data && data.count > 0) {
                if (data.unpaidTotal === 0) {
                  // All paid
                  cellBg = "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02]";
                  borderStyle = isToday ? "border-2 border-primary" : "border border-emerald-500/20";
                  heatColor = "bg-emerald-500";
                } else if (data.unpaidTotal < 1500000) {
                  // Low burden
                  cellBg = "bg-blue-500/[0.04] dark:bg-blue-500/[0.02]";
                  borderStyle = isToday ? "border-2 border-primary" : "border border-blue-500/20";
                  heatColor = "bg-blue-500";
                } else if (data.unpaidTotal < 5000000) {
                  // Medium burden
                  cellBg = "bg-amber-500/[0.06] dark:bg-amber-500/[0.03]";
                  borderStyle = isToday ? "border-2 border-primary" : "border border-amber-500/20";
                  heatColor = "bg-amber-500 animate-pulse-slow";
                } else {
                  // High burden
                  cellBg = "bg-rose-500/[0.08] dark:bg-rose-500/[0.04]";
                  borderStyle = isToday ? "border-2 border-primary" : "border border-rose-500/30";
                  heatColor = "bg-rose-600 animate-pulse-slow";
                }
              }

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => {
                    setSelectedDate(dateStr);
                  }}
                  className={`min-h-[64px] sm:min-h-[90px] p-1.5 sm:p-2 rounded-xl transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between items-start text-left focus:outline-none hover:shadow-md hover:bg-muted/30 ${cellBg} ${borderStyle}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs ${textStyle} ${isToday ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md text-[10px] font-bold" : ""}`}>
                      {dayNum}
                    </span>
                    {heatColor && (
                      <span className={`h-2 w-2 rounded-full ${heatColor}`} />
                    )}
                  </div>

                  {data && data.count > 0 && (
                    <div className="w-full mt-1.5 space-y-1">
                      {/* Desktop labels */}
                      <div className="hidden sm:block">
                        <p className="text-[9px] font-bold text-muted-foreground leading-none">
                          {data.count} Tagihan
                        </p>
                        <p className={`text-[10px] font-extrabold font-mono mt-0.5 leading-none ${data.unpaidTotal > 0 ? "text-foreground" : "text-emerald-600 line-through opacity-80"}`}>
                          {formatCompactCurrency(data.totalAmount)}
                        </p>
                      </div>
                      {/* Mobile label */}
                      <div className="block sm:hidden w-full text-center">
                        <span className={`inline-block text-[8px] font-black px-1 py-0.2 rounded-md ${data.unpaidTotal === 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
                          {data.count}t
                        </span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend & Guide */}
          <div className="mt-8 pt-6 border-t border-muted-foreground/10 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Panduan Alokasi &amp; Arus Kas Tagihan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs leading-normal">
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/10">
                <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-600">Semua Lunas</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Semua tagihan pada tanggal ini sudah diselesaikan.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-500/[0.02] border border-blue-500/10">
                <span className="h-3 w-3 rounded-full bg-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-600">{"Beban Rendah (< Rp 1,5jt)"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total tagihan kecil, relatif aman untuk menjadwalkan tagihan baru.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/[0.02] border border-amber-500/10">
                <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-600">{"Beban Sedang (Rp 1,5jt - 5jt)"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Beban menengah. Perhatikan arus kas sebelum menjadwalkan tambahan.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/[0.02] border border-rose-500/10">
                <span className="h-3 w-3 rounded-full bg-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-600">{"Beban Tinggi (\u2265 Rp 5jt)"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tagihan menumpuk! Pindahkan sebagian jatuh tempo ke tanggal lain.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
      ) : (
        <div className="space-y-4">
          {filteredBills.length === 0 ? (
            <div className="text-center py-16 px-4 bg-muted/20 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-bold">
                {searchQuery ? "Tagihan tidak ditemukan" : "Tidak ada tagihan supplier"}
              </p>
              <p className="text-xs max-w-xs">
                {searchQuery
                  ? "Cobalah mencari dengan nama supplier lain."
                  : "Semua pembayaran lunas! Gunakan tombol di atas untuk mencatatkan tagihan baru."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredBills.map((bill) => {
                const isLunas = bill.status === "LUNAS";
                const isLoading = actionLoadingId === bill.id;
                const todayStr = getLocalDateString(new Date());
                const billDateStr = getLocalDateString(bill.dueDate);
                const isOverdue = !isLunas && billDateStr < todayStr;

                return (
                  <Card
                    key={bill.id}
                    className={`overflow-hidden border-0 shadow-sm transition-all duration-200 ${
                      isLunas
                        ? "border-l-4 border-l-emerald-500 bg-emerald-500/[0.02] border border-emerald-500/10"
                        : isOverdue
                        ? "border-l-4 border-l-rose-500 bg-rose-500/[0.04] border border-rose-500/10 animate-pulse-slow"
                        : "border-l-4 border-l-blue-500 bg-blue-500/[0.02] border border-blue-500/10"
                    }`}
                  >
                    <CardContent className="p-4.5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                          {isLunas ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[9px] py-0 h-4 font-bold uppercase text-white">Lunas</Badge>
                          ) : isOverdue ? (
                            <Badge variant="destructive" className="text-[9px] py-0 h-4 font-bold uppercase text-white animate-bounce-slow">Terlewat / Overdue</Badge>
                          ) : (
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-[9px] py-0 h-4 font-bold uppercase text-white">Belum Bayar</Badge>
                          )}
                          {bill.calendarEventId && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 font-bold gap-1 border-blue-200 text-blue-600 dark:text-blue-400">
                              <Calendar className="h-2 w-2" />
                              Google Calendar
                            </Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" disabled={isLoading} onClick={() => handleDeleteBill(bill.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg -mt-1 -mr-1">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Supplier / Tujuan</p>
                        <h3 className="text-lg font-black tracking-tight leading-tight text-foreground">{bill.supplierName}</h3>
                        <div className="text-xl font-mono font-black text-primary pt-1">{formatCurrency(bill.amount)}</div>
                      </div>

                      {!isLunas && (() => {
                        const supplierReturns = initialPendingReturns.filter(
                          (ret) => ret.supplierName.trim().toLowerCase() === bill.supplierName.trim().toLowerCase()
                        );
                        if (supplierReturns.length === 0) return null;
                        return (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Ada Barang Retur ({supplierReturns.length})
                            </p>
                            <ul className="text-[10px] text-amber-600 dark:text-amber-300 list-disc list-inside font-medium">
                              {supplierReturns.map((ret) => (
                                <li key={ret.id} className="truncate">
                                  {ret.productName} (x{ret.quantity}) - <span className="underline">{ret.status === "RETURNED" ? "Telah dikirim" : "Di toko"}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}

                      <div className="pt-2 border-t border-dashed border-border/60 space-y-1 text-[11px] text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                          <span>Jatuh Tempo: {formatFullLocalDate(bill.dueDate, timezone)}</span>
                        </div>
                        {bill.createdBy && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground/75" />
                            <span>Dicatat Oleh: {bill.createdBy.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-1">
                        {isLunas ? (
                          <Button variant="outline" size="sm" disabled={isLoading} onClick={() => handleToggleStatus(bill.id, bill.status)} className="w-full text-xs font-semibold py-4.5 rounded-lg border-muted-foreground/20 text-muted-foreground hover:bg-accent flex items-center justify-center gap-1.5">
                            <Undo className="h-3.5 w-3.5" />
                            Tandai Belum Lunas
                          </Button>
                        ) : (
                          <Button size="lg" disabled={isLoading} onClick={() => handleToggleStatus(bill.id, bill.status)} className="w-full text-sm font-black py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5">
                            {isLoading ? (<Loader2 className="h-4.5 w-4.5 animate-spin" />) : (<CheckCircle2 className="h-4.5 w-4.5" />)}
                            Tandai Lunas
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialog: Catat Tagihan Baru */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Catat Tagihan Supplier
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan informasi tagihan supplier yang akan jatuh tempo agar terlacak di sistem kasir dan kalender Google.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Supplier Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Nama Supplier / Tujuan <span className="text-rose-500">*</span>
              </Label>
              <SupplierCombobox
                selectedId={supplierId}
                selectedName={supplierName}
                onChange={(id, name) => {
                  setSupplierId(id);
                  setSupplierName(name);
                }}
              />
            </div>

            {/* Nominal */}
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-bold">
                Nominal Tagihan (Rp) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/30 font-mono"
              />
            </div>

            {/* Jatuh Tempo */}
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-xs font-bold">
                Tanggal Jatuh Tempo <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/30"
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !supplierName.trim() || !amount || !dueDate}
                className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Tagihan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pilih Sumber Dana Pembayaran */}
      <Dialog open={paymentSourceDialogOpen} onOpenChange={setPaymentSourceDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">
              Pelunasan & Alokasi Pembayaran
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tentukan nominal pembayaran dari masing-masing sumber dana. Jumlah harus pas dengan total tagihan agar dapat disimpan.
            </DialogDescription>
          </DialogHeader>

          {/* ── Cashier Report Target Selector ── */}
          {isLoadingReports ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              Memeriksa laporan kasir aktif...
            </div>
          ) : activeReports.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-destructive">Laporan Shift Kasir Belum Ada</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Kasir belum membuat Laporan Shift. Koordinasikan dengan Kasir agar membuat laporan terlebih dahulu sebelum melakukan pembayaran tagihan.
                </p>
              </div>
            </div>
          ) : activeReports.length === 1 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-3 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-muted-foreground">Masuk ke laporan:</span>
              <span className="font-bold text-foreground">{activeReports[0].user.name} ({activeReports[0].shiftType})</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Laporan Kasir Tujuan
              </label>
              <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-muted/30">
                  <SelectValue placeholder="Pilih Kasir tujuan…" />
                </SelectTrigger>
                <SelectContent>
                  {activeReports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.user.name} – {r.shiftType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedBill && activeReports.length > 0 && (
            <form onSubmit={handleConfirmPayment} className="space-y-4 pt-2">
              <div className="p-3.5 bg-muted/50 rounded-xl space-y-1">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Total Tagihan:</span>
                  <span>Total Dialokasikan:</span>
                </div>
                <div className="flex justify-between font-mono font-black text-sm">
                  <span className="text-foreground">{formatCurrency(selectedBill.amount)}</span>
                  <span className={isAllocationValid ? "text-emerald-600" : "text-rose-500"}>
                    {formatCurrency(totalAllocated)}
                  </span>
                </div>
                {!isAllocationValid && (
                  <p className="text-[10px] text-rose-500 font-semibold text-right mt-1">
                    {totalAllocated > selectedBill.amount
                      ? `Kelebihan ${formatCurrency(totalAllocated - selectedBill.amount)}`
                      : `Kekurangan ${formatCurrency(selectedBill.amount - totalAllocated)}`}
                  </p>
                )}
              </div>

              {/* Uang Laci Kasir */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="payCashier" className="text-xs font-bold">
                    Uang Laci Kasir (Cash)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const currentAllocatedExcludingThis = (Number(payBill) || 0) + (Number(payTransfer) || 0);
                      const rem = Math.max(0, selectedBill.amount - currentAllocatedExcludingThis);
                      setPayCashier(rem.toString());
                    }}
                    className="h-6 text-[10px] font-bold text-primary px-2 hover:bg-primary/5 rounded"
                  >
                    Isi Sisa
                  </Button>
                </div>
                <Input
                  id="payCashier"
                  type="number"
                  placeholder="0"
                  value={payCashier}
                  onChange={(e) => setPayCashier(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30 font-mono"
                />
              </div>

              {/* Uang Titipan Tagihan */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="payBill" className="text-xs font-bold">
                    Uang Titipan Tagihan (Bill Money)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const currentAllocatedExcludingThis = (Number(payCashier) || 0) + (Number(payTransfer) || 0);
                      const rem = Math.max(0, selectedBill.amount - currentAllocatedExcludingThis);
                      setPayBill(rem.toString());
                    }}
                    className="h-6 text-[10px] font-bold text-primary px-2 hover:bg-primary/5 rounded"
                  >
                    Isi Sisa
                  </Button>
                </div>
                <Input
                  id="payBill"
                  type="number"
                  placeholder="0"
                  value={payBill}
                  onChange={(e) => setPayBill(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30 font-mono"
                />
              </div>

              {/* Transfer Bank */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="payTransfer" className="text-xs font-bold">
                    Transfer Bank Rekening Toko
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const currentAllocatedExcludingThis = (Number(payCashier) || 0) + (Number(payBill) || 0);
                      const rem = Math.max(0, selectedBill.amount - currentAllocatedExcludingThis);
                      setPayTransfer(rem.toString());
                    }}
                    className="h-6 text-[10px] font-bold text-primary px-2 hover:bg-primary/5 rounded"
                  >
                    Isi Sisa
                  </Button>
                </div>
                <Input
                  id="payTransfer"
                  type="number"
                  placeholder="0"
                  value={payTransfer}
                  onChange={(e) => setPayTransfer(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30 font-mono"
                />
              </div>

              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPaymentSourceDialogOpen(false);
                    setSelectedBillId(null);
                  }}
                  className="w-full sm:w-auto text-xs font-semibold rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={!isAllocationValid}
                  className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                >
                  Konfirmasi Pelunasan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Detail Tagihan Per Tanggal */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => { if (!open) { setSelectedDate(null); setReschedulingBillId(null); } }}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">
              Tagihan Jatuh Tempo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detail tagihan untuk tanggal {selectedDate && new Date(selectedDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {selectedDate && (!billsByDate[selectedDate] || billsByDate[selectedDate].bills.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-6">Tidak ada tagihan untuk tanggal ini.</p>
            ) : (
              selectedDate && billsByDate[selectedDate].bills.map((bill) => {
                const isLunas = bill.status === "LUNAS";
                const isRescheduling = reschedulingBillId === bill.id;
                
                return (
                  <div key={bill.id} className="rounded-xl border p-3.5 bg-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-foreground leading-tight">{bill.supplierName}</p>
                        <p className="text-sm font-black font-mono text-primary">{formatCurrency(bill.amount)}</p>
                      </div>
                      <Badge className={isLunas ? "bg-emerald-600 text-white text-[9px] font-bold uppercase" : "bg-blue-600 text-white text-[9px] font-bold uppercase"}>
                        {isLunas ? "Lunas" : "Belum Lunas"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-muted-foreground/5 justify-between">
                      <div className="flex items-center gap-1.5">
                        {!isLunas ? (
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => {
                              setSelectedDate(null); // Close calendar detail
                              setSelectedBillId(bill.id);
                              setPaymentSourceDialogOpen(true); // Open payment dialog
                            }}
                            className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5"
                          >
                            Bayar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => handleToggleStatus(bill.id, bill.status)}
                            className="h-7 text-[10px] font-semibold text-muted-foreground rounded-lg px-2.5"
                          >
                            Batal Lunas
                          </Button>
                        )}
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            if (isRescheduling) {
                              setReschedulingBillId(null);
                            } else {
                              setReschedulingBillId(bill.id);
                              setRescheduleDate(bill.dueDate.split("T")[0]);
                            }
                          }}
                          className="h-7 text-[10px] font-semibold text-primary hover:bg-primary/5 rounded-lg px-2.5"
                        >
                          {isRescheduling ? "Batal" : "Jadwal Ulang"}
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => {
                          handleDeleteBill(bill.id);
                          setSelectedDate(null);
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {isRescheduling && (
                      <div className="p-3 bg-muted/40 rounded-lg space-y-2 border border-dashed border-primary/20 animate-in slide-in-from-top duration-200">
                        <Label htmlFor={`new-date-${bill.id}`} className="text-[10px] font-bold text-muted-foreground">Pilih Tanggal Jatuh Tempo Baru</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`new-date-${bill.id}`}
                            type="date"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="h-8 text-xs bg-background"
                          />
                          <Button
                            size="sm"
                            type="button"
                            disabled={isRescheduleLoading}
                            onClick={() => handleRescheduleBill(bill.id)}
                            className="h-8 text-xs font-bold"
                          >
                            {isRescheduleLoading ? "..." : "Simpan"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setReschedulingBillId(null);
              }}
              className="w-full text-xs font-bold rounded-xl"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
