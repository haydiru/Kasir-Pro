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
  FileText,
  Printer,
  MessageSquare,
} from "lucide-react";
import {
  shiftReports,
  formatCurrency,
  formatDateTime,
  calcExpectedCash,
  getStatusColor,
  getExpenditureTotal,
  type ShiftReport,
} from "@/lib/mock-data";
import Link from "next/link";

export default function CashierHistoryPage() {
  const [searchDate, setSearchDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);

  // Filter reports for current cashier (mock: show all)
  const filteredReports = shiftReports.filter((r) => {
    const matchesDate = !searchDate || r.date.includes(searchDate);
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
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Tidak ada laporan ditemukan
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => {
                  const expected = calcExpectedCash(report);
                  const diff = report.manualCashCount - expected;
                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.date}</TableCell>
                      <TableCell>{report.userName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {report.shiftType === "Pagi" ? "☀️" : "🌙"} {report.shiftType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.storeName.split(" - ")[1] || report.storeName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(report.posCash)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {report.status === "Verified" && report.finalAdminVariance !== null ? (
                          <span
                            className={
                              report.finalAdminVariance < 0
                                ? "text-destructive"
                                : report.finalAdminVariance > 0
                                ? "text-emerald-600"
                                : ""
                            }
                          >
                            {report.finalAdminVariance >= 0 ? "+" : ""}
                            {formatCurrency(report.finalAdminVariance)}
                          </span>
                        ) : (
                          <span
                            className={
                              diff < 0
                                ? "text-destructive"
                                : diff > 0
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                            }
                          >
                            {diff >= 0 ? "+" : ""}
                            {formatCurrency(diff)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusColor(report.status)}`}>
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
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link href={`/cashier/report/${report.id}/print`}>
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail Laporan
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedReport.userName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedReport.storeName} • {selectedReport.date} • Shift{" "}
                    {selectedReport.shiftType}
                  </p>
                </div>
                <Badge className={getStatusColor(selectedReport.status)}>
                  {selectedReport.status}
                </Badge>
              </div>

              <Separator />

              {/* Financial */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modal Awal</span>
                  <span className="font-mono">{formatCurrency(selectedReport.startingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">POS Tunai</span>
                  <span className="font-mono">{formatCurrency(selectedReport.posCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">POS Debit</span>
                  <span className="font-mono">{formatCurrency(selectedReport.posDebit)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Seharusnya</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(calcExpectedCash(selectedReport))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Manual</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(selectedReport.manualCashCount)}
                  </span>
                </div>
              </div>

              {/* Digital Transactions */}
              {selectedReport.digitalTransactions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Layanan Digital ({selectedReport.digitalTransactions.length})
                  </p>
                  <div className="space-y-1.5">
                    {selectedReport.digitalTransactions.map((dt) => (
                      <div key={dt.id} className="flex justify-between text-sm rounded-md bg-muted/50 px-3 py-2">
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-2">
                            {dt.serviceType}
                          </Badge>
                          <span className="text-muted-foreground">{dt.detailContact}</span>
                        </div>
                        <span className="font-mono">{formatCurrency(dt.grossAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenditures */}
              {selectedReport.expenditures.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Pengeluaran ({selectedReport.expenditures.length})
                  </p>
                  <div className="space-y-1.5">
                    {selectedReport.expenditures.map((ex) => {
                      const total = getExpenditureTotal(ex);
                      return (
                        <div key={ex.id} className="text-sm rounded-md bg-muted/50 px-3 py-2">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{ex.supplierName}</span>
                            <span className="font-mono font-semibold">
                              {formatCurrency(total)}
                            </span>
                          </div>
                          <div className="flex gap-3 text-[11px] text-muted-foreground">
                            {ex.amountFromBill > 0 && (
                              <span className="font-mono">📋 Tagihan {formatCurrency(ex.amountFromBill)}</span>
                            )}
                            {ex.amountFromCashier > 0 && (
                              <span className="font-mono text-destructive">💰 Kasir {formatCurrency(ex.amountFromCashier)}</span>
                            )}
                            {ex.amountFromTransfer > 0 && (
                              <span className="font-mono">🔄 Transfer {formatCurrency(ex.amountFromTransfer)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin notes (if verified) */}
              {selectedReport.status === "Verified" && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Catatan Verifikasi Admin
                    </span>
                  </div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-300">
                    {selectedReport.adminNotes || "Tidak ada catatan."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Selisih Admin: {selectedReport.finalAdminVariance !== null
                      ? `${selectedReport.finalAdminVariance >= 0 ? "+" : ""}${formatCurrency(selectedReport.finalAdminVariance)}`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Diverifikasi: {selectedReport.verifiedAt ? formatDateTime(selectedReport.verifiedAt) : "—"}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/cashier/report/${selectedReport.id}/print`}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
