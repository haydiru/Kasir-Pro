"use client";

import { useState, useTransition } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, ClipboardCheck, AlertTriangle, TrendingUp, TrendingDown, Wallet, Zap } from "lucide-react";
import { formatCurrency, formatTime, getRoleLabel, calcExpectedCash } from "@/lib/utils";
import { getAdminDashboardStats, type DashboardStatsResult } from "@/app/actions/dashboard";
import { getPayrollRecap, type PayrollRecapItem } from "@/app/actions/payroll";
import { toast } from "sonner";

// ──── Types ────

interface ActiveAttendanceUser {
  id: string;
  name: string;
  role: string;
}
interface ActiveAttendance {
  id: string;
  user: ActiveAttendanceUser;
  clockIn: string;
  shiftType: string;
}

interface VerifiedReport {
  id: string;
  user: { name: string };
  date: string;
  shiftType: string;
  manualCashCount: number;
  finalAdminVariance: number | null;
  adminNotes: string | null;
  startingCash: number;
  posCash: number;
  posDebit: number;
  billMoneyReceived: number;
  digitalTransactions: { isNonCash: boolean; grossAmount: number }[];
  expenditures: { amountFromCashier: number; amountFromBill: number; amountFromTransfer: number }[];
}

interface Props {
  activeAttendances: ActiveAttendance[];
  submittedCount: number;
  verifiedReports: VerifiedReport[];
  payrollRecap: PayrollRecapItem[];
  initialStats: DashboardStatsResult;
  initialStartDate: string;
  initialEndDate: string;
  timezone: string;
}

// ──── Currency Tooltip ────

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card shadow-lg p-3 text-xs space-y-1">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-mono font-bold">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ──── Summary Card ────

function SummaryCard({
  title, value, icon: Icon, colorClass, subtext
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
  subtext?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
            <p className="mt-1 text-xl font-bold tracking-tight truncate">{value}</p>
            {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──── Main Component ────

export function DashboardClient({
  activeAttendances,
  submittedCount,
  verifiedReports,
  payrollRecap,
  initialStats,
  initialStartDate,
  initialEndDate,
  timezone,
}: Props) {
  const [stats, setStats] = useState<DashboardStatsResult>(initialStats);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [isPending, startTransition] = useTransition();

  function handlePreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: timezone });
    const s = fmt(start);
    const e = fmt(end);
    setStartDate(s);
    setEndDate(e);
    fetchStats(s, e);
  }

  function fetchStats(s: string, e: string) {
    startTransition(async () => {
      const res = await getAdminDashboardStats(s, e);
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        toast.error(res.error || "Gagal memuat data");
      }
    });
  }

  const { summary, daily } = stats;

  const chartData = daily.map((d) => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="space-y-6">

      {/* ── Summary Cards Row 1 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Omzet Hari Ini" value={formatCurrency(summary.totalOmzet)} icon={DollarSign} colorClass="bg-chart-1/10 text-chart-1" />
        <SummaryCard title="Pegawai Aktif" value={String(activeAttendances.length)} icon={Users} colorClass="bg-chart-2/10 text-chart-2" subtext="Sedang bertugas saat ini" />
        <SummaryCard title="Menunggu Verifikasi" value={String(submittedCount)} icon={ClipboardCheck} colorClass="bg-amber-500/10 text-amber-500" />
        <SummaryCard title="Flip Belum Cocok" value="0" icon={AlertTriangle} colorClass="bg-destructive/10 text-destructive" />
      </div>

      {/* ── Filter Bar ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              {[
                { label: "Hari Ini", days: 1 },
                { label: "7 Hari", days: 7 },
                { label: "30 Hari", days: 30 },
              ].map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handlePreset(p.days)}
                  className="rounded-full text-xs h-8"
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => fetchStats(startDate, endDate)}
                className="h-8 rounded-full text-xs"
              >
                {isPending ? "Memuat..." : "Tampilkan"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Financial Summary Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SummaryCard title="Total Omzet" value={formatCurrency(summary.totalOmzet)} icon={TrendingUp} colorClass="bg-emerald-500/10 text-emerald-600" />
        <SummaryCard title="Omzet Cash" value={formatCurrency(summary.omzetCash)} icon={Wallet} colorClass="bg-blue-500/10 text-blue-600" />
        <SummaryCard title="Omzet Debit" value={formatCurrency(summary.omzetDebit)} icon={DollarSign} colorClass="bg-violet-500/10 text-violet-600" />
        <SummaryCard title="Total Pengeluaran" value={formatCurrency(summary.totalExpenditure)} icon={TrendingDown} colorClass="bg-rose-500/10 text-rose-600" />
        <SummaryCard title="Pendapatan Digital" value={formatCurrency(summary.digitalRevenue)} icon={Zap} colorClass="bg-amber-500/10 text-amber-600" />
        <SummaryCard title="Laba Digital" value={formatCurrency(summary.digitalProfit)} icon={Zap} colorClass="bg-teal-500/10 text-teal-600" />
      </div>

      {/* ── Charts ── */}
      {chartData.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Tidak ada data untuk periode yang dipilih.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar Chart: Cash vs Debit */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Omzet Cash vs Debit</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="omzetCash" name="Cash" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="omzetDebit" name="Debit" fill="#8b5cf6" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart: Pengeluaran */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pengeluaran Harian</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="expenditure" name="Pengeluaran" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Area Chart: Digital Revenue & Profit */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pendapatan & Laba Digital</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="digitalRevenue" name="Pendapatan Digital" stroke="#f59e0b" fill="url(#colorRevenue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="digitalProfit" name="Laba Digital" stroke="#14b8a6" fill="url(#colorProfit)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Live Monitor + Payroll side by side ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Pegawai Aktif */}
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
                <p className="text-sm text-muted-foreground text-center py-6">Tidak ada pegawai aktif saat ini</p>
              ) : (
                activeAttendances.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {att.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleLabel(att.user.role)} • Clock-in {formatTime(att.clockIn, timezone)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{att.shiftType}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rekap Absensi */}
        <Card className="border-0 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Rekap Absensi (Periode Berjalan)</CardTitle>
              <Badge variant="secondary" className="font-normal text-xs">Siklus Gaji</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {payrollRecap.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Tidak ada data pegawai</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-center">Hari</TableHead>
                    <TableHead className="text-center">Jam</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecap.map((item) => (
                    <TableRow key={item.userId}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="truncate max-w-32">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{getRoleLabel(item.role)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="bg-primary/5 text-primary px-2 py-0.5 rounded text-[10px] font-medium">{item.periodLabel}</span>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {item.totalDays} <span className="text-xs font-normal text-muted-foreground">hari</span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {item.totalHours} <span className="text-xs font-normal text-muted-foreground">jam</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.isCurrentlyActive ? (
                          <span className="text-xs text-emerald-500 font-medium">● Aktif</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Offline</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Rekap Selisih Kasir ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rekap Selisih Kasir (Verified)</CardTitle>
        </CardHeader>
        <CardContent>
          {verifiedReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada laporan terverifikasi</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kasir</TableHead>
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
                      <TableCell className="font-medium">{report.user.name}</TableCell>
                      <TableCell>
                        {new Date(report.date + "T12:00:00").toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric", timeZone: timezone
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{report.shiftType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(expected)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(report.manualCashCount)}</TableCell>
                      <TableCell className="text-right">
                        {report.finalAdminVariance !== null && (
                          <span className={report.finalAdminVariance < 0 ? "text-destructive font-semibold" : report.finalAdminVariance > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                            {report.finalAdminVariance >= 0 ? "+" : ""}
                            {formatCurrency(report.finalAdminVariance)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{report.adminNotes || "—"}</TableCell>
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
