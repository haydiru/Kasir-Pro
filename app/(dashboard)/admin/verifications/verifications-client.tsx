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
import { verifyShiftReport } from "@/app/actions/admin";
import { deleteShiftReport } from "@/app/actions/report";
import { useRouter } from "next/navigation";

interface VerificationsClientProps {
  submittedReports: any[];
  verifiedReports: any[];
  unmatchedFlips: any[];
  timezone: string;
}

export function VerificationsClient({ submittedReports, verifiedReports, unmatchedFlips, timezone }: VerificationsClientProps) {
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const router = useRouter();

  const [verifyState, verifyAction, isVerifying] = useActionState(verifyShiftReport, undefined);

  useEffect(() => {
    if (verifyState === "SUCCESS") {
      toast.success("Laporan berhasil diverifikasi", {
        description: `Laporan telah di-approve.`,
      });
      setVerifyDialogOpen(false);
    } else if (verifyState) {
      toast.error(verifyState);
    }
  }, [verifyState]);

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
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-semibold">
            Menunggu Verifikasi
          </h2>
          <Badge variant="secondary" className="text-xs">
            {submittedReports.length}
          </Badge>
        </div>

        {submittedReports.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Semua laporan sudah diverifikasi 🎉
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {submittedReports.map((report) => {
              const expected = calcExpectedCash(report);
              const diff = report.manualCashCount - expected;
              
              const dayStartMs = new Date(report.date).getTime();
              const dayEndMs = report.submittedAt ? new Date(report.submittedAt).getTime() : new Date().getTime();

              const reportUnmatchedFlips = unmatchedFlips.filter((fw) => {
                const txTime = new Date(fw.transactionTime).getTime();
                const isWithinShift = txTime >= dayStartMs && txTime <= dayEndMs;
                const isNotInReport = !report.digitalTransactions.some((dt: any) => dt.flipId === fw.flipId);
                return isWithinShift && isNotInReport;
              });

              return (
                <Card key={report.id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Left: Report Info */}
                      <div className="flex-1 p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{report.user.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {report.store.name} • {formatLocalDate(report.date, timezone)} • Shift {report.shiftType}
                            </p>
                          </div>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Modal Awal</p>
                            <p className="font-mono font-medium">{formatCurrency(report.startingCash)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">POS Tunai</p>
                            <p className="font-mono font-medium">{formatCurrency(report.posCash)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">POS Debit</p>
                            <p className="font-mono font-medium">{formatCurrency(report.posDebit)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Layanan Digital</p>
                            <p className="font-mono font-medium">
                              {report.digitalTransactions.length} transaksi
                            </p>
                          </div>
                        </div>

                        {reportUnmatchedFlips.length > 0 && (
                          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mt-3">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-destructive">
                                {reportUnmatchedFlips.length} transaksi Flip belum tercatat di laporan ini:
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {reportUnmatchedFlips.map((fw: any) => (
                                  <Badge key={fw.id} variant="outline" className="border-destructive/30 text-destructive text-[10px] font-mono gap-1 bg-white/50">
                                    {fw.flipId} • {fw.serviceType}: {formatCurrency(fw.nominal)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {report.digitalTransactions.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="text-xs">Jenis</TableHead>
                                  <TableHead className="text-xs">Detail</TableHead>
                                  <TableHead className="text-xs text-right">Nominal</TableHead>
                                  <TableHead className="text-xs text-right">Laba</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {report.digitalTransactions.map((dt: any) => (
                                  <TableRow key={dt.id}>
                                    <TableCell className="text-xs">
                                      <Badge variant="outline" className="text-[10px]">{dt.serviceType}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{dt.detailContact}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatCurrency(dt.grossAmount)}</TableCell>
                                    <TableCell className="text-xs text-right font-mono text-emerald-600">+{formatCurrency(dt.profitAmount)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {report.expenditures.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Pengeluaran ({report.expenditures.length})
                            </p>
                            <div className="space-y-1.5">
                              {report.expenditures.map((ex: any) => {
                                const total = getExpenditureTotal(ex);
                                return (
                                  <div key={ex.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-medium">{ex.supplierName}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-muted-foreground ml-5">
                                        <span className="font-mono font-semibold text-foreground text-[11px]">
                                          Total: {formatCurrency(total)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Verification Summary */}
                      <div className="w-full md:w-64 border-t md:border-t-0 md:border-l bg-muted/20 p-5 flex flex-col gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Cash Seharusnya</p>
                          <p className="text-lg font-bold font-mono">{formatCurrency(expected)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cash Manual Kasir</p>
                          <p className="text-lg font-bold font-mono">{formatCurrency(report.manualCashCount)}</p>
                        </div>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground">Selisih Kasir</p>
                          <p className={`text-lg font-bold font-mono ${diff < 0 ? "text-destructive" : diff > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {diff >= 0 ? "+" : ""}
                            {formatCurrency(diff)}
                          </p>
                        </div>

                        {diff !== 0 && (
                          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">
                              Ada selisih {formatCurrency(Math.abs(diff))} antara hitungan kasir dan sistem
                            </p>
                          </div>
                        )}

                        <div className="mt-auto flex gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="bg-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
                            onClick={() => handleDelete(report.id)}
                            disabled={isDeleting === report.id}
                            title="Hapus Laporan"
                          >
                            <Trash2 className={`h-4 w-4 ${isDeleting === report.id ? "animate-pulse" : ""}`} />
                          </Button>
                          <Button className="flex-1" onClick={() => handleOpenVerify(report)}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Verifikasi
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Verified */}
      {verifiedReports.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Terverifikasi
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Diverifikasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifiedReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.user.name}</TableCell>
                      <TableCell>{formatLocalDate(report.date, timezone)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{report.shiftType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={(report.finalAdminVariance ?? 0) < 0 ? "text-destructive" : (report.finalAdminVariance ?? 0) > 0 ? "text-emerald-600" : ""}>
                          {(report.finalAdminVariance ?? 0) >= 0 ? "+" : ""}
                          {formatCurrency(report.finalAdminVariance ?? 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                        {report.adminNotes || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.verifiedAt ? formatDateTime(report.verifiedAt.toISOString(), timezone) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Verification Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
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
          <form action={verifyAction} className="space-y-4 pt-2">
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
