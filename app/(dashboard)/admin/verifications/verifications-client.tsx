"use client";

import { useState, useActionState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  ShieldCheck,
  CheckCircle2,
  Calculator,
  FileText,
  AlertTriangle,
  Trash2,
  ExternalLink,
  RotateCcw
} from "lucide-react";
import { 
  formatCurrency, 
  formatDateTime, 
  getRoleLabel, 
  getStatusColor, 
  getRoleBadgeVariant,
  calcExpectedCash,
  getExpenditureTotal,
  formatLocalDate,
  getTZDateRange
} from "@/lib/utils";
import { toast } from "sonner";
import { verifyShiftReport, unverifyShiftReport } from "@/app/actions/admin";
import { deleteShiftReport } from "@/app/actions/report";
import { useRouter } from "next/navigation";

interface VerificationsClientProps {
  submittedReports: any[];
  verifiedReports: any[];
  unmatchedFlips: any[];
  flipWebhooks?: any[];
  timezone: string;
}

function findMatchedFlip(dt: any, flipWebhooks: any[]) {
  if (!flipWebhooks || flipWebhooks.length === 0) return null;

  const cleanFlipId = dt.flipId?.replace(/^#/, "").trim().toUpperCase();
  if (!cleanFlipId) return null;

  // 1. Exact match
  const exact = flipWebhooks.find((fw) => {
    const fwId = fw.flipId?.replace(/^#/, "").trim().toUpperCase();
    return fwId === cleanFlipId;
  });
  if (exact) return exact;

  // 2. Alphanumeric prefix / partial match
  const partial = flipWebhooks.find((fw) => {
    const fwId = fw.flipId?.replace(/^#/, "").trim().toUpperCase();
    if (!fwId) return false;
    return cleanFlipId.startsWith(fwId) || fwId.startsWith(cleanFlipId);
  });
  if (partial) return partial;

  return null;
}

export function VerificationsClient({ submittedReports, verifiedReports, unmatchedFlips, flipWebhooks = [], timezone }: VerificationsClientProps) {
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const router = useRouter();

  const [verifyState, verifyAction, isVerifying] = useActionState(verifyShiftReport, undefined);
  const [unverifyState, unverifyAction, isUnverifying] = useActionState(unverifyShiftReport, undefined);

  useEffect(() => {
    if (verifyState?.status === "SUCCESS") {
      toast.success("Laporan berhasil diverifikasi", {
        description: `Laporan telah di-approve.`,
      });
      setVerifyDialogOpen(false);
      setSelectedReport(null);
      router.refresh();
    } else if (verifyState?.status === "ERROR") {
      toast.error(verifyState.message);
    }
  }, [verifyState, router]);

  useEffect(() => {
    if (unverifyState?.status === "SUCCESS") {
      toast.success("Verifikasi laporan dibatalkan");
      router.refresh();
    } else if (unverifyState?.status === "ERROR") {
      toast.error(unverifyState.message);
    }
  }, [unverifyState, router]);

  const handleOpenVerify = (report: any) => {
    setSelectedReport(report);
    setVerifyDialogOpen(true);
  };

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

  return (
    <div className="space-y-6">
      {/* Pending Verifications */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-2xs">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Menunggu Verifikasi Setoran
          </h2>
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-500/20">
            {submittedReports.length}
          </span>
        </div>

        {submittedReports.length === 0 ? (
          <div className="rounded-2xl border border-border/80 bg-card p-12 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3 shadow-2xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">
              Semua laporan shift telah diverifikasi
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tidak ada antrean setoran kasir yang menunggu approval saat ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {submittedReports.map((report) => {
              const expected = calcExpectedCash(report);
              const diff = report.manualCashCount - expected;
              
              const tz = timezone || "Asia/Jakarta";
              const { start, end } = getTZDateRange(new Date(report.date), tz);
              const dayStartMs = start.getTime();
              const dayEndMs = report.submittedAt ? new Date(report.submittedAt).getTime() : end.getTime();

              const reportFlipIds = new Set(
                report.digitalTransactions
                  .map((dt: any) => (dt.flipId?.replace(/^#/, "") || "").trim().toUpperCase())
                  .filter(Boolean)
              );

              const reportUnmatchedFlips = unmatchedFlips.filter((fw) => {
                const txTime = new Date(fw.transactionTime).getTime();
                const isWithinShift = txTime >= dayStartMs && txTime <= dayEndMs;
                const fwId = (fw.flipId?.replace(/^#/, "") || "").trim().toUpperCase();
                const isNotInReport = !reportFlipIds.has(fwId);
                
                return isWithinShift && isNotInReport;
              });

              return (
                <div key={report.id} className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all duration-200">
                  <div className="flex flex-col md:flex-row">
                    {/* Left: Report Info */}
                    <div className="flex-1 p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-base text-foreground">{report.user.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border/60">
                              {report.store.name}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border/60">
                              📅 {formatLocalDate(report.date, timezone)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                              Shift {report.shiftType}
                            </span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          report.status === "Submitted"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        }`}>
                          {report.status}
                        </span>
                      </div>

                      <Separator className="border-border/60" />

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                          <p className="text-muted-foreground font-semibold">Modal Awal</p>
                          <p className="font-mono font-bold text-sm text-foreground mt-0.5">{formatCurrency(report.startingCash)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                          <p className="text-muted-foreground font-semibold">POS Tunai</p>
                          <p className="font-mono font-bold text-sm text-foreground mt-0.5">{formatCurrency(report.posCash)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                          <p className="text-muted-foreground font-semibold">POS Debit</p>
                          <p className="font-mono font-bold text-sm text-indigo-600 mt-0.5">{formatCurrency(report.posDebit)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                          <p className="text-muted-foreground font-semibold">Uang Tagihan</p>
                          <p className="font-mono font-bold text-sm text-foreground mt-0.5">{formatCurrency(report.billMoneyReceived)}</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-tight">Sisa Tagihan</p>
                          <p className="font-mono font-bold text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                            {formatCurrency(report.billMoneyReceived - report.expenditures.reduce((acc: number, curr: any) => acc + (curr.amountFromBill || 0), 0))}
                          </p>
                        </div>
                      </div>

                      {reportUnmatchedFlips.length > 0 && (
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2.5 shadow-2xs">
                          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{reportUnmatchedFlips.length} Transaksi Flip Belum Tercatat di Laporan Ini:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {reportUnmatchedFlips.map((fw: any) => (
                              <div 
                                key={fw.id} 
                                className="flex items-center justify-between gap-3 bg-card border border-rose-500/30 p-2.5 px-3 rounded-xl shadow-2xs"
                              >
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                                      #{fw.flipId?.replace(/^#/, "")}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.2 text-[9px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                                      {fw.serviceType}
                                    </span>
                                  </div>
                                  {(fw.customerName || fw.bankOrProvider) && (
                                    <span className="text-xs font-semibold text-foreground truncate mt-1">
                                      👤 {fw.customerName || "Tanpa Nama"} {fw.bankOrProvider ? `(${fw.bankOrProvider})` : ""}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-black text-sm text-foreground">
                                    {formatCurrency(fw.nominal)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.digitalTransactions.length > 0 && (
                        <div className="rounded-xl border border-border/80 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                <TableHead className="text-xs font-bold">Jenis & ID Flip</TableHead>
                                <TableHead className="text-xs font-bold">Detail / Customer</TableHead>
                                <TableHead className="text-xs font-bold text-right">Nominal</TableHead>
                                <TableHead className="text-xs font-bold text-right">Laba</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {report.digitalTransactions.map((dt: any) => {
                                const rawFlipId = dt.flipId ? dt.flipId.replace(/^#/, "").trim() : null;
                                const matchedFlip = findMatchedFlip(dt, flipWebhooks);

                                return (
                                  <TableRow key={dt.id}>
                                    <TableCell className="text-xs">
                                      <div className="flex flex-col gap-1">
                                        <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold w-fit border border-border/60">
                                          {dt.serviceType}
                                        </span>
                                        {rawFlipId && (
                                          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold px-2 py-0.5 w-fit">
                                            #{rawFlipId}
                                          </span>
                                        )}
                                        <span className="text-[9px] text-muted-foreground font-bold">
                                          {dt.isNonCash ? `Non-Tunai (${dt.paymentMethod || "Tanpa Ket."})` : "Tunai"}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-foreground">{dt.detailContact || "—"}</span>
                                        {matchedFlip?.customerName && (
                                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                            👤 {matchedFlip.customerName}
                                          </span>
                                        )}
                                        {matchedFlip?.bankOrProvider && (
                                          <span className="text-[10px] text-muted-foreground">
                                            🏦 {matchedFlip.bankOrProvider} {matchedFlip?.customerNumber ? `(${matchedFlip.customerNumber})` : ""}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-mono font-bold">{formatCurrency(dt.grossAmount)}</TableCell>
                                    <TableCell className="text-xs text-right font-mono text-emerald-600 font-bold">+{formatCurrency(dt.profitAmount)}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {report.expenditures.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                            Pengeluaran ({report.expenditures.length})
                          </p>
                          <div className="space-y-1.5">
                            {report.expenditures.map((ex: any) => {
                              const total = ex.amountFromCashier + ex.amountFromBill + ex.amountFromTransfer;
                              return (
                                <div key={ex.id} className="flex flex-col rounded-xl border border-border/80 px-3.5 py-2 text-xs bg-muted/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="font-bold text-foreground">{ex.supplierName}</span>
                                    </div>
                                    <span className="font-mono font-black text-rose-600">
                                      {formatCurrency(total)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 ml-5 text-[10px] text-muted-foreground leading-tight">
                                    {ex.amountFromCashier > 0 && <span>Tunai: {formatCurrency(ex.amountFromCashier)}</span>}
                                    {ex.amountFromBill > 0 && <span className="text-amber-600 font-bold">Tagihan: {formatCurrency(ex.amountFromBill)}</span>}
                                    {ex.amountFromTransfer > 0 && <span>Transfer: {formatCurrency(ex.amountFromTransfer)}</span>}
                                    {ex.receiptUrl && (
                                      <a href={ex.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5 ml-auto font-bold">
                                        <ExternalLink className="h-2 w-2" /> Bukti
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Verification Summary */}
                    <div className="w-full md:w-68 border-t md:border-t-0 md:border-l border-border/80 bg-muted/30 p-5 flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Sistem</p>
                          <p className="text-lg font-black font-mono text-foreground mt-0.5">{formatCurrency(expected)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Fisik Kasir</p>
                          <p className="text-lg font-black font-mono text-foreground mt-0.5">{formatCurrency(report.manualCashCount)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selisih Kasir</p>
                          <p className={`text-lg font-black font-mono mt-0.5 ${diff < 0 ? "text-destructive" : diff > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {diff >= 0 ? "+" : ""}
                            {formatCurrency(diff)}
                          </p>
                        </div>

                        {diff !== 0 && (
                          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-tight">
                              Ada selisih {formatCurrency(Math.abs(diff))} antara kasir dan sistem
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20 h-10 w-10 shrink-0"
                          onClick={() => handleDelete(report.id)}
                          disabled={isDeleting === report.id}
                          title="Hapus Laporan"
                        >
                          <Trash2 className={`h-4 w-4 ${isDeleting === report.id ? "animate-pulse" : ""}`} />
                        </Button>
                        <Button 
                          className="flex-1 rounded-xl font-bold h-10 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90" 
                          onClick={() => handleOpenVerify(report)}
                        >
                          <ShieldCheck className="mr-1.5 h-4 w-4" />
                          Verifikasi
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Verified */}
      {verifiedReports.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Riwayat Setoran Terverifikasi
            </h2>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              {verifiedReports.length}
            </span>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-bold text-xs">Kasir</TableHead>
                  <TableHead className="font-bold text-xs">Tanggal</TableHead>
                  <TableHead className="font-bold text-xs">Shift</TableHead>
                  <TableHead className="font-bold text-xs text-right">Selisih Akhir</TableHead>
                  <TableHead className="font-bold text-xs">Catatan Admin</TableHead>
                  <TableHead className="font-bold text-xs">Diverifikasi Oleh</TableHead>
                  <TableHead className="font-bold text-xs">Waktu</TableHead>
                  <TableHead className="font-bold text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-bold text-xs text-foreground">{report.user.name}</TableCell>
                    <TableCell className="text-xs">{formatLocalDate(report.date, timezone)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground border border-border/60">
                        {report.shiftType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs">
                      <span className={(report.finalAdminVariance ?? 0) < 0 ? "text-destructive" : (report.finalAdminVariance ?? 0) > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                        {(report.finalAdminVariance ?? 0) >= 0 ? "+" : ""}
                        {formatCurrency(report.finalAdminVariance ?? 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                      {report.adminNotes || "—"}
                    </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.verifiedBy?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.verifiedAt ? formatDateTime(report.verifiedAt.toISOString(), timezone) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenVerify(report)}>
                            <RotateCcw className="mr-1 h-4 w-4" />
                            Re-verify
                          </Button>
                          <form action={unverifyAction} className="inline">
                            <input type="hidden" name="reportId" value={report.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={isUnverifying}
                              onClick={(event) => {
                                if (!confirm(`Batalkan verifikasi laporan ${report.user.name} pada ${formatLocalDate(report.date, timezone)}?`)) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              Batalkan
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

      {/* Verification Dialog */}
      <Dialog
        open={verifyDialogOpen}
        onOpenChange={(open) => {
          setVerifyDialogOpen(open);
          if (!open) {
            setSelectedReport(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Verifikasi Laporan
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.user.name} — {selectedReport ? formatLocalDate(selectedReport.date, timezone) : ""} Shift {selectedReport?.shiftType}
            </DialogDescription>
          </DialogHeader>
          <form key={selectedReport?.id || "verify-form"} action={verifyAction} className="space-y-4 pt-2">
            <input type="hidden" name="reportId" value={selectedReport?.id || ""} />
            
            {selectedReport && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cash Seharusnya</span>
                  <span className="font-mono font-medium">{formatCurrency(calcExpectedCash(selectedReport))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cash Manual Kasir</span>
                  <span className="font-mono font-medium">{formatCurrency(selectedReport.manualCashCount)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-variance">Selisih Fisik Aktual (Rp)</Label>
              <Input
                id="admin-variance"
                name="variance"
                type="number"
                placeholder="Contoh: -5000 (minus jika kurang)"
                className="font-mono"
                defaultValue={selectedReport ? selectedReport.manualCashCount - calcExpectedCash(selectedReport) : 0}
              />
              <p className="text-xs text-muted-foreground">
                Input 0 jika sesuai, minus jika kurang, plus jika lebih
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-notes">Catatan Verifikasi</Label>
              <Textarea
                id="admin-notes"
                name="notes"
                placeholder="Contoh: Uang kembalian kurang Rp5.000..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setVerifyDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="flex-1" disabled={isVerifying}>
                {isVerifying ? "Menyimpan" : "Approve"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
