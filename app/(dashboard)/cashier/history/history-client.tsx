"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Search,
  Printer,
  MessageSquare,
  FileEdit,
  Trash2,
  Zap,
  ShoppingBag,
  CreditCard,
  ExternalLink,
  Calculator,
  AlertCircle,
  Clock
} from "lucide-react";
import { 
  formatCurrency, 
  formatDateTime, 
  getRoleLabel, 
  getStatusColor,
  calcExpectedCash,
  getExpenditureTotal,
  cn,
  formatLocalDate
} from "@/lib/utils";
import Link from "next/link";
import { deleteShiftReport } from "@/app/actions/report";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface HistoryClientProps {
  initialReports: any[];
  userRole?: string;
  timezone: string;
}

export function HistoryClient({ initialReports, userRole, timezone }: HistoryClientProps) {
  const [searchDate, setSearchDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: session } = useSession();
  const router = useRouter();

  const isAdmin = userRole === "admin" || userRole === "super_admin" || session?.user?.role === "admin" || session?.user?.role === "super_admin";

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus laporan ini secara permanen?")) return;
    
    setIsDeleting(id);
    try {
      const res = await deleteShiftReport(id);
      if (res.success) {
        toast.success("Laporan berhasil dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus laporan");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan teknis");
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredReports = initialReports.filter((r) => {
    const reportDateStr = formatLocalDate(r.date, timezone);
    const matchesDate = !searchDate || reportDateStr === searchDate;
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    return matchesDate && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Toko</TableHead>
                <TableHead className="text-right">POS Tunai</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Tidak ada laporan yang sesuai filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => {
                  const expected = calcExpectedCash(report);
                  const diff = report.manualCashCount - expected;

                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {formatLocalDate(report.date, timezone)}
                      </TableCell>
                      <TableCell>{report.user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {report.shiftType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {report.store.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(report.posCash)}
                      </TableCell>
                      <TableCell className="text-right">
                        {report.status === "Draft" ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          <span
                            className={
                              diff < 0
                                ? "text-destructive font-medium"
                                : diff > 0
                                ? "text-emerald-600 font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {diff >= 0 ? "+" : ""}
                            {formatCurrency(diff)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${getStatusColor(report.status)}`}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedReport(report)}
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Edit Laporan"
                            disabled={report.status === "Verified"}
                          >
                            <Link href={`/cashier/report?id=${report.id}`}>
                              <FileEdit className={cn("h-4 w-4 text-muted-foreground", report.status === "Verified" && "opacity-20")} />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Print Bukti"
                          >
                            <Link href={`/cashier/report/${report.id}/print`}>
                              <Printer className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(report.id)}
                              disabled={isDeleting === report.id}
                              title="Hapus Laporan"
                            >
                              <Trash2 className={`h-4 w-4 ${isDeleting === report.id ? "animate-pulse" : ""}`} />
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
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Laporan Shift</DialogTitle>
          </DialogHeader>
          
           {selectedReport && (
            <div className="space-y-6 pt-2 pb-4">
               {/* Summary Header */}
               <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/50">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status Laporan</p>
                    <Badge className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-none", getStatusColor(selectedReport.status))}>
                        {selectedReport.status}
                    </Badge>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dibuat Oleh</p>
                    <p className="text-sm font-bold">{selectedReport.user.name}</p>
                  </div>
               </div>

               {/* Meta Info Grid */}
               <div className="grid grid-cols-2 gap-6 px-1">
                 <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Tanggal & Shift</span>
                    </div>
                    <p className="text-sm font-bold">{formatLocalDate(selectedReport.date, timezone)}</p>
                    <p className="text-xs text-muted-foreground font-medium">{selectedReport.shiftType}</p>
                 </div>
                 <div className="text-right">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-end">
                        <span className="text-[10px] font-black uppercase tracking-wider">Lokasi Toko</span>
                    </div>
                    <p className="text-sm font-bold">{selectedReport.store.name}</p>
                 </div>
               </div>

               <Separator className="opacity-50" />

               {/* Financial Data Section */}
               <div className="space-y-4">
                 <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                        <Calculator className="h-4 w-4" />
                    </div>
                    <h4 className="font-bold text-sm">Ringkasan Keuangan</h4>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-2 p-4 rounded-2xl bg-background border border-border/50 shadow-sm">
                    <div className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground font-medium">Modal Awal Laci</span>
                        <span className="font-mono font-bold">{formatCurrency(selectedReport.startingCash)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground font-medium">POS Tunai</span>
                        <span className="font-mono font-bold">{formatCurrency(selectedReport.posCash)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b border-dashed pb-2">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <CreditCard className="h-3 w-3" /> POS Debit
                        </span>
                        <span className="font-mono font-bold">{formatCurrency(selectedReport.posDebit || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 pt-2">
                        <span className="text-muted-foreground font-medium">Tagihan Tambahan</span>
                        <span className="font-mono font-bold">{formatCurrency(selectedReport.billMoneyReceived)}</span>
                    </div>

                    {/* Remaining Bill Calculation */}
                    <div className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground font-medium">Sisa Uang Tagihan</span>
                        <span className="font-mono font-bold text-amber-600">
                            {formatCurrency(selectedReport.billMoneyReceived - selectedReport.expenditures.reduce((acc: number, curr: any) => acc + curr.amountFromBill, 0))}
                        </span>
                    </div>
                    
                    {/* Digital Profit Total */}
                    {selectedReport.digitalTransactions?.length > 0 && (
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground font-medium">Total Laba Layanan</span>
                            <span className="font-mono font-bold text-emerald-600">
                                +{formatCurrency(selectedReport.digitalTransactions.reduce((acc: number, curr: any) => acc + curr.profitAmount, 0))}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between text-base font-black py-2 mt-2 border-t-2 border-primary/10">
                        <span className="text-foreground">Hitungan Kasir (Manual)</span>
                        <span className="font-mono text-primary">{formatCurrency(selectedReport.manualCashCount)}</span>
                    </div>

                    {/* Admin Variance - Only if verified and has info */}
                    {selectedReport.status === "Verified" && selectedReport.finalAdminVariance !== null && (
                        <div className="flex justify-between text-sm py-2 mt-1 px-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                            <span className="text-orange-600 font-bold">Varians Admin (Final)</span>
                            <span className={cn("font-mono font-black", selectedReport.finalAdminVariance < 0 ? "text-destructive" : "text-emerald-600")}>
                                {selectedReport.finalAdminVariance > 0 ? "+" : ""}{formatCurrency(selectedReport.finalAdminVariance)}
                            </span>
                        </div>
                    )}
                 </div>
               </div>

               {/* Digital Transactions list */}
               {selectedReport.digitalTransactions?.length > 0 && (
                 <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                            <Zap className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-sm">Layanan Digital</h4>
                    </div>
                    <div className="border border-border/50 rounded-2xl overflow-hidden bg-muted/20">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent border-0 h-10">
                                    <TableHead className="text-[10px] font-black uppercase pl-4">Layanan</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Tujuan</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-right pr-4">Nominal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedReport.digitalTransactions.map((tx: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-primary/5 transition-all h-12 border-border/30">
                                        <TableCell className="pl-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold leading-none">{tx.serviceType}</span>
                                                <span className="text-[9px] text-muted-foreground font-black uppercase mt-1">
                                                    {tx.isNonCash ? `Non-Tunai (${tx.paymentMethod || "Tanpa Ket."})` : "Tunai"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium text-muted-foreground font-mono">
                                            {tx.detailContact}
                                        </TableCell>
                                        <TableCell className="text-right pr-4 font-mono font-bold text-xs">
                                            {formatCurrency(tx.grossAmount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                 </div>
               )}

               {/* Expenditures list */}
               {selectedReport.expenditures?.length > 0 && (
                 <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                            <ShoppingBag className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-sm">Pengeluaran & Belanja</h4>
                    </div>
                    <div className="space-y-2">
                        {selectedReport.expenditures.map((ex: any, idx: number) => (
                            <div key={idx} className="flex flex-col p-4 rounded-2xl bg-rose-500/[0.02] border border-rose-500/10 hover:border-rose-500/30 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="space-y-1">
                                        <span className="text-xs font-black text-rose-600 uppercase tracking-tighter">Supplier / Barang</span>
                                        <p className="text-sm font-bold">{ex.supplierName}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Total Bayar</span>
                                        <p className="text-sm font-black text-rose-600 font-mono">
                                            {formatCurrency(ex.amountFromCashier + ex.amountFromBill + ex.amountFromTransfer)}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 mt-3 pt-3 border-t border-rose-500/5">
                                    {ex.amountFromCashier > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                            <span className="text-[10px] font-bold text-muted-foreground">Tunai Kasir: {formatCurrency(ex.amountFromCashier)}</span>
                                        </div>
                                    )}
                                    {ex.amountFromBill > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                            <span className="text-[10px] font-bold text-muted-foreground">Uang Tagihan: {formatCurrency(ex.amountFromBill)}</span>
                                        </div>
                                    )}
                                    {ex.amountFromTransfer > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                            <span className="text-[10px] font-bold text-muted-foreground">Transfer: {formatCurrency(ex.amountFromTransfer)}</span>
                                        </div>
                                    )}
                                    {ex.receiptUrl && (
                                        <div className="flex justify-start items-center sm:justify-end">
                                            <Button 
                                                variant="link" 
                                                size="sm" 
                                                className="h-auto p-0 text-[10px] gap-1 text-blue-600 hover:text-blue-800"
                                                asChild
                                            >
                                                <a href={ex.receiptUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-2.5 w-2.5" /> Lihat Bukti
                                                </a>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
               )}

               <Separator className="opacity-50" />

                {/* Cashier Revision Notes */}
                {selectedReport.cashierNote && (
                  <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/10 p-4 space-y-3">
                     <div className="flex items-center gap-2 text-indigo-700 font-bold">
                       <FileEdit className="h-4 w-4" />
                       <span className="text-xs uppercase tracking-wider">Log Revisi Kasir</span>
                     </div>
                     <p className="text-xs text-indigo-900/80 whitespace-pre-wrap font-mono bg-indigo-500/[0.03] p-3 rounded-xl border border-indigo-500/5 leading-relaxed">
                       {selectedReport.cashierNote}
                     </p>
                  </div>
                )}

               {/* Admin Notes if verified */}
               {selectedReport.status === "Verified" && selectedReport.adminNotes && (
                 <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 font-bold">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-wider">Catatan Verifikasi Admin</span>
                    </div>
                    <div className="p-3 bg-amber-500/[0.03] rounded-xl border border-amber-500/5">
                        <p className="text-sm text-amber-900 font-medium italic">
                            "{selectedReport.adminNotes}"
                        </p>
                    </div>
                 </div>
               )}
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
