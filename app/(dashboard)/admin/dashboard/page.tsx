"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  DollarSign,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  attendances,
  shiftReports,
  revenueChartData,
  flipWebhooks,
  formatCurrency,
  formatTime,
  calcExpectedCash,
  getRoleLabel,
  getStatusColor,
} from "@/lib/mock-data";

// Simple bar chart component (no external dep needed for mock)
function MiniBarChart() {
  const maxVal = Math.max(
    ...revenueChartData.map((d) => d.tunai + d.debit + d.digital)
  );

  return (
    <div className="flex items-end gap-2 h-44">
      {revenueChartData.map((d) => {
        const total = d.tunai + d.debit + d.digital;
        const tunaiH = (d.tunai / maxVal) * 100;
        const debitH = (d.debit / maxVal) * 100;
        const digitalH = (d.digital / maxVal) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center gap-0.5" style={{ height: `${(total / maxVal) * 100}%` }}>
              <div
                className="w-full rounded-t-sm bg-chart-1 transition-all duration-500"
                style={{ height: `${tunaiH}%`, minHeight: "2px" }}
                title={`Tunai: ${formatCurrency(d.tunai)}`}
              />
              <div
                className="w-full bg-chart-2 transition-all duration-500"
                style={{ height: `${debitH}%`, minHeight: "2px" }}
                title={`Debit: ${formatCurrency(d.debit)}`}
              />
              <div
                className="w-full rounded-b-sm bg-chart-3 transition-all duration-500"
                style={{ height: `${digitalH}%`, minHeight: "2px" }}
                title={`Digital: ${formatCurrency(d.digital)}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.date.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const activeAttendances = attendances.filter((a) => !a.clockOut);
  const submittedReports = shiftReports.filter((r) => r.status === "Submitted");
  const verifiedReports = shiftReports.filter((r) => r.status === "Verified");
  const unmatchedFlip = flipWebhooks.filter((f) => !f.matched);

  const todayRevenue = revenueChartData[revenueChartData.length - 1];
  const yesterdayRevenue = revenueChartData[revenueChartData.length - 2];
  const todayTotal = todayRevenue.tunai + todayRevenue.debit + todayRevenue.digital;
  const yesterdayTotal = yesterdayRevenue.tunai + yesterdayRevenue.debit + yesterdayRevenue.digital;
  const revenueChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Omzet Hari Ini */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Omzet Hari Ini
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {formatCurrency(todayTotal)}
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {revenueChange >= 0 ? (
                    <>
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600 font-medium">
                        +{revenueChange.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-red-600 font-medium">
                        {revenueChange.toFixed(1)}%
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">vs kemarin</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-1/10">
                <DollarSign className="h-5 w-5 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pegawai Aktif */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pegawai Aktif
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {activeAttendances.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sedang bertugas saat ini
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-2/10">
                <Users className="h-5 w-5 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Laporan Pending */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Menunggu Verifikasi
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {submittedReports.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Laporan submitted
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10">
                <ClipboardCheck className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flip Warning */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Flip Belum Cocok
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {unmatchedFlip.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Perlu dicek kasir
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Live Monitor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Revenue Chart */}
        <Card className="border-0 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Statistik Omzet (6 Hari Terakhir)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <MiniBarChart />
            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-chart-1" />
                POS Tunai
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-chart-2" />
                POS Debit
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-chart-3" />
                Digital
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Monitor */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pegawai Aktif</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAttendances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Tidak ada pegawai aktif saat ini
                </p>
              ) : (
                activeAttendances.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {att.userName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleLabel(att.role)} • Clock-in {formatTime(att.clockIn)}
                      </p>
                    </div>
                    <Badge
                      variant={att.shiftType === "Pagi" ? "secondary" : "outline"}
                      className="text-xs shrink-0"
                    >
                      {att.shiftType === "Pagi" ? "☀️" : "🌙"} {att.shiftType}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Variance Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rekap Selisih Kasir (Verified)</CardTitle>
        </CardHeader>
        <CardContent>
          {verifiedReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Belum ada laporan terverifikasi
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Toko</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead className="text-right">Seharusnya</TableHead>
                  <TableHead className="text-right">Manual Count</TableHead>
                  <TableHead className="text-right">Selisih Admin</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedReports.map((report) => {
                  const expected = calcExpectedCash(report);
                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.userName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {report.storeName.split(" - ")[1] || report.storeName}
                      </TableCell>
                      <TableCell>{report.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {report.shiftType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(expected)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(report.manualCashCount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {report.finalAdminVariance !== null && (
                          <span
                            className={
                              report.finalAdminVariance < 0
                                ? "text-destructive font-semibold"
                                : report.finalAdminVariance > 0
                                ? "text-emerald-600 font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {report.finalAdminVariance >= 0 ? "+" : ""}
                            {formatCurrency(report.finalAdminVariance)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                        {report.adminNotes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
