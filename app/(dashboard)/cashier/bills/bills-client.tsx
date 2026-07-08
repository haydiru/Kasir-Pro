"use client";

import { useState, useMemo, useTransition } from "react";
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
  Undo
} from "lucide-react";
import { formatCurrency, formatFullLocalDate, formatLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import { createBill, updateBillStatus, deleteBill } from "@/app/actions/bill";
import SupplierCombobox from "@/components/supplier-combobox";

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

  async function handleConfirmPayment(source: "CASHIER" | "BILL" | "TRANSFER") {
    if (!selectedBillId) return;
    const id = selectedBillId;
    setPaymentSourceDialogOpen(false);
    setActionLoadingId(id);
    try {
      const res = await updateBillStatus(id, "LUNAS", source);
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-card border-muted-foreground/10 text-sm"
          />
        </div>

        <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl w-fit self-end sm:self-auto">
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

      {/* Bills list */}
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
              
              // Cek status kedaluwarsa (Overdue)
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
                    {/* Header: Status badge & delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {isLunas ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[9px] py-0 h-4 font-bold uppercase text-white">
                            Lunas
                          </Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive" className="text-[9px] py-0 h-4 font-bold uppercase text-white animate-bounce-slow">
                            Terlewat / Overdue
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-[9px] py-0 h-4 font-bold uppercase text-white">
                            Belum Bayar
                          </Badge>
                        )}

                        {bill.calendarEventId && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 font-bold gap-1 border-blue-200 text-blue-600 dark:text-blue-400">
                            <Calendar className="h-2 w-2" />
                            Google Calendar
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading}
                        onClick={() => handleDeleteBill(bill.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg -mt-1 -mr-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Nominal & Supplier */}
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                        Supplier / Tujuan
                      </p>
                      <h3 className="text-lg font-black tracking-tight leading-tight text-foreground">
                        {bill.supplierName}
                      </h3>
                      <div className="text-xl font-mono font-black text-primary pt-1">
                        {formatCurrency(bill.amount)}
                      </div>
                    </div>

                    {/* Warning Barang Retur yang Belum Tuntas */}
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

                    {/* Metadata: Jatuh Tempo */}
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

                    {/* Action button */}
                    <div className="pt-1">
                      {isLunas ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleToggleStatus(bill.id, bill.status)}
                          className="w-full text-xs font-semibold py-4.5 rounded-lg border-muted-foreground/20 text-muted-foreground hover:bg-accent flex items-center justify-center gap-1.5"
                        >
                          <Undo className="h-3.5 w-3.5" />
                          Tandai Belum Lunas
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          disabled={isLoading}
                          onClick={() => handleToggleStatus(bill.id, bill.status)}
                          className="w-full text-sm font-black py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4.5 w-4.5" />
                          )}
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
              Pilih Sumber Dana Pembayaran
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih sumber dana yang digunakan untuk melunasi tagihan ini. Data pembayaran akan otomatis diteruskan ke laporan shift aktif jika sedang berjalan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-4">
            <Button
              onClick={() => handleConfirmPayment("CASHIER")}
              variant="outline"
              className="h-16 flex flex-col items-start justify-center p-4 rounded-xl border border-muted-foreground/15 hover:border-primary hover:bg-primary/5 text-left"
            >
              <span className="font-bold text-sm text-foreground">Uang Laci Kasir (Cash Drawer)</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Memotong saldo tunai laci kasir saat tutup shift.</span>
            </Button>

            <Button
              onClick={() => handleConfirmPayment("BILL")}
              variant="outline"
              className="h-16 flex flex-col items-start justify-center p-4 rounded-xl border border-muted-foreground/15 hover:border-primary hover:bg-primary/5 text-left"
            >
              <span className="font-bold text-sm text-foreground">Uang Titipan Tagihan (Bill Money)</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Menggunakan kas titipan khusus supplier. Tidak memotong uang laci.</span>
            </Button>

            <Button
              onClick={() => handleConfirmPayment("TRANSFER")}
              variant="outline"
              className="h-16 flex flex-col items-start justify-center p-4 rounded-xl border border-muted-foreground/15 hover:border-primary hover:bg-primary/5 text-left"
            >
              <span className="font-bold text-sm text-foreground">Transfer Bank Rekening Toko</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Dibayar langsung dari rekening bank toko. Tidak memengaruhi uang laci.</span>
            </Button>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPaymentSourceDialogOpen(false);
                setSelectedBillId(null);
              }}
              className="w-full text-xs font-semibold rounded-xl"
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
