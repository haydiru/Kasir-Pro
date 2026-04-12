"use client";

import { useState } from "react";
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
  Eye,
  CheckCircle2,
  Calculator,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  shiftReports,
  formatCurrency,
  formatDateTime,
  calcExpectedCash,
  getStatusColor,
  getExpenditureTotal,
  flipWebhooks,
  type ShiftReport,
} from "@/lib/mock-data";
import { toast } from "sonner";

export default function AdminVerificationsPage() {
  const [reports, setReports] = useState(shiftReports);
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [variance, setVariance] = useState("");
  const [notes, setNotes] = useState("");

  const submittedReports = reports.filter((r) => r.status === "Submitted");
  const verifiedReports = reports.filter((r) => r.status === "Verified");

  const handleOpenVerify = (report: ShiftReport) => {
    setSelectedReport(report);
    setVariance("");
    setNotes("");
    setVerifyDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedReport) return;

    setReports((prev) =>
      prev.map((r) =>
        r.id === selectedReport.id
          ? {
              ...r,
              status: "Verified" as const,
              finalAdminVariance: variance ? parseFloat(variance) : 0,
              adminNotes: notes,
              verifiedAt: new Date().toISOString(),
            }
          : r
      )
    );
    setVerifyDialogOpen(false);
    toast.success("Laporan berhasil diverifikasi", {
      description: `Laporan ${selectedReport.userName} telah di-approve.`,
    });
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
              
              const unmatchedFlips = flipWebhooks.filter(
                (fw) => !fw.matched && !report.digitalTransactions.some((dt) => dt.flipId === fw.flipId)
              );

              return (
                <Card key={report.id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Left: Report Info */}
                      <div className="flex-1 p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{report.userName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {report.storeName} • {report.date} • Shift {report.shiftType}
                            </p>
                          </div>
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </div>

                        <Separator />

                        {/* Financial Summary */}
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

                        {/* Flip Warning */}
                        {unmatchedFlips.length > 0 && (
                          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mt-3">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-destructive">
                                {unmatchedFlips.length} transaksi Flip belum tercatat!
                              </p>
                              <ul className="mt-1 space-y-0.5">
                                {unmatchedFlips.map((f) => (
                                  <li key={f.flipId} className="text-[10px] text-muted-foreground">
                                    {f.flipId} — {formatCurrency(f.nominal)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Digital Transactions Table */}
                        {report.digitalTransactions.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="text-xs">Jenis</TableHead>
                                  <TableHead className="text-xs">Detail</TableHead>
                                  <TableHead className="text-xs text-right">Nominal</TableHead>
                                  <TableHead className="text-xs text-right">Laba</TableHead>
                                  <TableHead className="text-xs">ID Flip</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {report.digitalTransactions.map((dt) => (
                                  <TableRow key={dt.id}>
                                    <TableCell className="text-xs">
                                      <Badge variant="outline" className="text-[10px]">
                                        {dt.serviceType}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {dt.detailContact}
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-mono">
                                      {formatCurrency(dt.grossAmount)}
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-mono text-emerald-600">
                                      +{formatCurrency(dt.profitAmount)}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">
                                      {dt.flipId || "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {/* Expenditures */}
                        {report.expenditures.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Pengeluaran ({report.expenditures.length})
                            </p>
                            <div className="space-y-1.5">
                              {report.expenditures.map((ex) => {
                                const total = getExpenditureTotal(ex);
                                return (
                                  <div
                                    key={ex.id}
                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                                  >
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-medium">{ex.supplierName}</span>
                                        {ex.receiptUrl && (
                                          <a
                                            href={ex.receiptUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-sm transition-colors"
                                          >
                                            Lihat Nota
                                          </a>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-muted-foreground ml-5">
                                        {ex.amountFromBill > 0 && (
                                          <span className="font-mono text-[10px]" title="Uang Tagihan">
                                            📋 {formatCurrency(ex.amountFromBill)}
                                          </span>
                                        )}
                                        {ex.amountFromCashier > 0 && (
                                          <span className="font-mono text-[10px] text-destructive" title="Uang Kasir">
                                            💰 {formatCurrency(ex.amountFromCashier)}
                                          </span>
                                        )}
                                        {ex.amountFromTransfer > 0 && (
                                          <span className="font-mono text-[10px]" title="Transfer">
                                            🔄 {formatCurrency(ex.amountFromTransfer)}
                                          </span>
                                        )}
                                        <span className="font-mono font-semibold text-foreground text-[11px]">
                                          = {formatCurrency(total)}
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
                          <p
                            className={`text-lg font-bold font-mono ${
                              diff < 0
                                ? "text-destructive"
                                : diff > 0
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {diff >= 0 ? "+" : ""}
                            {formatCurrency(diff)}
                          </p>
                        </div>

                        {diff !== 0 && (
                          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-2.5">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Ada selisih {formatCurrency(Math.abs(diff))} antara hitungan kasir dan sistem
                            </p>
                          </div>
                        )}

                        <div className="mt-auto">
                          <p className="text-[10px] text-muted-foreground mb-1.5">
                            Submitted: {report.submittedAt ? formatDateTime(report.submittedAt) : "—"}
                          </p>
                          <Button
                            className="w-full"
                            onClick={() => handleOpenVerify(report)}
                          >
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
                      <TableCell className="font-medium">{report.userName}</TableCell>
                      <TableCell>{report.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {report.shiftType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span
                          className={
                            (report.finalAdminVariance ?? 0) < 0
                              ? "text-destructive"
                              : (report.finalAdminVariance ?? 0) > 0
                              ? "text-emerald-600"
                              : ""
                          }
                        >
                          {(report.finalAdminVariance ?? 0) >= 0 ? "+" : ""}
                          {formatCurrency(report.finalAdminVariance ?? 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                        {report.adminNotes || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.verifiedAt ? formatDateTime(report.verifiedAt) : "—"}
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
              {selectedReport?.userName} — {selectedReport?.date} Shift{" "}
              {selectedReport?.shiftType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedReport && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cash Seharusnya</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(calcExpectedCash(selectedReport))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cash Manual Kasir</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedReport.manualCashCount)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-variance">Selisih Fisik Aktual (Rp)</Label>
              <Input
                id="admin-variance"
                type="number"
                placeholder="Contoh: -5000 (minus jika kurang)"
                value={variance}
                onChange={(e) => setVariance(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Input 0 jika sesuai, minus jika kurang, plus jika lebih
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-notes">Catatan Verifikasi</Label>
              <Textarea
                id="admin-notes"
                placeholder="Contoh: Uang kembalian kurang Rp5.000..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setVerifyDialogOpen(false)}
              >
                Batal
              </Button>
              <Button className="flex-1" onClick={handleApprove}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
