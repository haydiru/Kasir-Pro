"use client";

import { useState, useEffect } from "react";
import {
  getFlipTransactions,
  toggleFlipExcluded,
  deleteFlipTransaction,
  bulkDeleteFlipTransactions,
} from "@/app/actions/flip";
import { syncFlipEmailsFromGmail } from "@/app/actions/flip-gmail";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Smartphone,
  Search,
  CheckCircle2,
  AlertTriangle,
  Mail,
  EyeOff,
  Eye,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  initialTransactions: any[];
  initialMonth: number;
  initialYear: number;
  isSuperAdmin?: boolean;
}

export function FlipTransactionsClient({
  initialTransactions,
  initialMonth,
  initialYear,
  isSuperAdmin = false,
}: Props) {
  const [transactions, setTransactions] = useState<any[]>(initialTransactions);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Background non-blocking sync: Eksekusi di latar belakang HANYA saat pertama kali halaman dimuat
  useEffect(() => {
    syncFlipEmailsFromGmail().then((res) => {
      if (res?.newCount && res.newCount > 0) {
        getFlipTransactions(month, year).then((r) => {
          if (r.success && r.data) setTransactions(r.data);
        });
      }
    }).catch(() => {});
  }, []);

  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  const years = [initialYear - 1, initialYear, initialYear + 1];

  async function fetchForMonthYear(m: number, y: number) {
    setIsLoading(true);
    setSelectedIds([]);
    try {
      const res = await getFlipTransactions(m, y);
      if (res.success && res.data) {
        setTransactions(r => res.data);
        toast.success(`Data ${months[m - 1].label} ${y} dimuat`);
      } else {
        toast.error(res.error || "Gagal memuat data");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch() {
    await fetchForMonthYear(month, year);
  }

  async function handleToggleExclude(id: string) {
    try {
      const res = await toggleFlipExcluded(id);
      if (res.success && res.data) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, excluded: res.data.excluded } : t
          )
        );
        toast.success(
          res.data.excluded
            ? "Transaksi ditandai bukan milik kasir"
            : "Transaksi dikembalikan ke daftar aktif"
        );
      } else {
        toast.error(res.error || "Gagal mengubah status");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  }

  async function handleDeleteSingle(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi Flip ini secara permanen?")) {
      return;
    }
    const target = transactions.find((t) => t.id === id);
    if (!target) return;

    // Optimistic removal: hapus instan dari layar tanpa menunggu jaringan
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));

    try {
      const res = await deleteFlipTransaction(id);
      if (res.success) {
        toast.success("Transaksi Flip berhasil dihapus");
      } else {
        // Rollback jika server gagal
        setTransactions((prev) => [target, ...prev]);
        toast.error(res.error || "Gagal menghapus transaksi");
      }
    } catch {
      // Rollback jika terjadi exception
      setTransactions((prev) => [target, ...prev]);
      toast.error("Terjadi kesalahan sistem saat menghapus");
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} transaksi Flip yang dipilih secara permanen?`
      )
    ) {
      return;
    }

    const idsToDelete = [...selectedIds];
    const targets = transactions.filter((t) => idsToDelete.includes(t.id));

    // Optimistic removal: hapus instan dari layar tanpa menunggu jaringan
    setTransactions((prev) => prev.filter((t) => !idsToDelete.includes(t.id)));
    setSelectedIds([]);

    try {
      const res = await bulkDeleteFlipTransactions(idsToDelete);
      if (res.success) {
        toast.success(`${idsToDelete.length} transaksi Flip berhasil dihapus`);
      } else {
        // Rollback jika server gagal
        setTransactions((prev) => [...targets, ...prev]);
        toast.error(res.error || "Gagal menghapus transaksi massal");
      }
    } catch {
      // Rollback jika terjadi exception
      setTransactions((prev) => [...targets, ...prev]);
      toast.error("Terjadi kesalahan saat menghapus massal");
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(transactions.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  }

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  }

  function getStatusBadge(tx: any) {
    if (tx.excluded) {
      return (
        <Badge className="bg-muted text-muted-foreground border-border shadow-none text-[10px] font-bold uppercase gap-1">
          <EyeOff className="h-3 w-3" /> Dikecualikan
        </Badge>
      );
    }
    if (tx.matched) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none text-[10px] font-bold uppercase gap-1">
          <CheckCircle2 className="h-3 w-3" /> Cocok
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none text-[10px] font-bold uppercase gap-1">
        <AlertTriangle className="h-3 w-3" /> Belum Cocok
      </Badge>
    );
  }

  function getServiceBadge(type: string) {
    const colors: Record<string, string> = {
      Transfer: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      PDAM: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
      Listrik: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
      Indihome: "bg-red-500/10 text-red-600 border-red-500/20",
      "Pulsa/Paket Data": "bg-purple-500/10 text-purple-600 border-purple-500/20",
      "Top Up E-Walet": "bg-green-500/10 text-green-600 border-green-500/20",
    };
    return (
      <Badge
        className={`${colors[type] || "bg-muted text-foreground"} shadow-none text-[10px] font-bold uppercase`}
      >
        {type}
      </Badge>
    );
  }

  const stats = {
    total: transactions.length,
    matched: transactions.filter((t) => t.matched && !t.excluded).length,
    unmatched: transactions.filter((t) => !t.matched && !t.excluded).length,
    excluded: transactions.filter((t) => t.excluded).length,
  };

  const isAllSelected =
    transactions.length > 0 && selectedIds.length === transactions.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Transaksi Flip
        </h1>
        <p className="text-muted-foreground">
          Daftar transaksi digital dari email Flip untuk sinkronisasi dengan laporan kasir.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Email</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.matched}</p>
              <p className="text-xs text-muted-foreground">Cocok</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.unmatched}</p>
              <p className="text-xs text-muted-foreground">Belum Cocok</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{stats.excluded}</p>
              <p className="text-xs text-muted-foreground">Dikecualikan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                📅 Bulan
              </label>
              <Select
                value={String(month)}
                onValueChange={(v) => {
                  const m = Number(v);
                  setMonth(m);
                  fetchForMonthYear(m, year);
                }}
              >
                <SelectTrigger className="w-40 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                📅 Tahun
              </label>
              <Select
                value={String(year)}
                onValueChange={(v) => {
                  const y = Number(v);
                  setYear(y);
                  fetchForMonthYear(month, y);
                }}
              >
                <SelectTrigger className="w-28 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="h-11 rounded-xl px-6 gap-2"
            >
              <Search className="h-4 w-4" />
              {isLoading ? "Memuat..." : "Tampilkan Data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-xl overflow-hidden bg-card/40 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border/50 h-14">
                  {isSuperAdmin && (
                    <TableHead className="w-12 pl-4 text-center">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(c) => handleSelectAll(!!c)}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead className={`font-black text-xs uppercase tracking-widest ${isSuperAdmin ? "pl-2" : "pl-6"}`}>
                    Tanggal
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest">
                    ID Flip
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest">
                    Jenis
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest">
                    Customer
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest text-right">
                    Nominal
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest text-center">
                    Status
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest text-center pr-6">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isSuperAdmin ? 8 : 7}
                      className="text-center py-20 text-muted-foreground italic"
                    >
                      Belum ada data transaksi Flip untuk periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const isSelected = selectedIds.includes(tx.id);
                    return (
                      <TableRow
                        key={tx.id}
                        className={`border-border/20 hover:bg-primary/5 transition-all h-14 ${
                          tx.excluded ? "opacity-50" : ""
                        } ${isSelected ? "bg-primary/10 hover:bg-primary/15" : ""}`}
                      >
                        {isSuperAdmin && (
                          <TableCell className="pl-4 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(c) => handleSelectRow(tx.id, !!c)}
                              aria-label={`Select ${tx.flipId}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className={isSuperAdmin ? "pl-2" : "pl-6"} suppressHydrationWarning>
                          <div className="flex flex-col" suppressHydrationWarning>
                            <span className="text-sm font-bold" suppressHydrationWarning>
                              {new Date(tx.transactionTime).toLocaleDateString(
                                "id-ID",
                                { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }
                              )}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium" suppressHydrationWarning>
                              {new Date(tx.transactionTime).toLocaleTimeString(
                                "id-ID",
                                { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-bold text-primary">
                            #{tx.flipId}
                          </span>
                        </TableCell>
                        <TableCell>{getServiceBadge(tx.serviceType)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col max-w-[240px]">
                            <span className={`text-sm font-bold truncate ${tx.customerName ? "text-foreground" : "text-muted-foreground italic text-xs"}`}>
                              {tx.customerName ? `👤 ${tx.customerName}` : "— (Tanpa Nama)"}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {tx.bankOrProvider && (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                  🏦 {tx.bankOrProvider}
                                </span>
                              )}
                              {tx.customerNumber && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {tx.customerNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm">
                          {formatCurrency(tx.nominal)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(tx)}
                        </TableCell>
                        <TableCell className="text-center pr-6">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 rounded-xl text-xs gap-1.5 ${
                                tx.excluded
                                  ? "text-primary hover:text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              onClick={() => handleToggleExclude(tx.id)}
                              title={
                                tx.excluded
                                  ? "Kembalikan ke daftar aktif"
                                  : "Tandai bukan transaksi kasir"
                              }
                            >
                              {tx.excluded ? (
                                <>
                                  <Eye className="h-3.5 w-3.5" /> Aktifkan
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" /> Kecualikan
                                </>
                              )}
                            </Button>

                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isDeleting}
                                className="h-8 rounded-xl text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSingle(tx.id)}
                                title="Hapus transaksi ini (Khusus Super Admin)"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Hapus
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Floating Action Bar for Bulk Delete (Super Admin only) */}
      {isSuperAdmin && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-foreground text-background dark:bg-card dark:text-foreground px-6 py-3.5 rounded-2xl shadow-2xl border border-border animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <span>{selectedIds.length} transaksi dipilih</span>
          </div>
          <div className="h-4 w-px bg-border/40" />
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleBulkDelete}
              className="rounded-xl px-4 font-bold gap-1.5 shadow-lg shadow-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Menghapus..." : `Hapus (${selectedIds.length})`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="rounded-xl px-3 text-xs opacity-80 hover:opacity-100"
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
