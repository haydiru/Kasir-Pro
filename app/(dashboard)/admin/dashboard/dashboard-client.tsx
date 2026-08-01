"use client";

import { useState, useTransition } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, DollarSign, ClipboardCheck, AlertTriangle, TrendingUp, TrendingDown,
  Wallet, Zap, Loader2, Trophy, Sparkles, Lightbulb, Target, ShieldAlert, BarChart3,
  Calendar, ShoppingBag, CreditCard, Flame
} from "lucide-react";
import { formatCurrency, formatTime, getRoleLabel, calcExpectedCash } from "@/lib/utils";
import {
  getAdminDashboardStats,
  type DashboardStatsResult,
  type UserPerformanceEntry,
  type SmartInsight,
  type ConsumerBehaviorInsight,
  type WeekdayVsWeekendStats
} from "@/app/actions/dashboard";
import { getPayrollRecap, type PayrollRecapItem } from "@/app/actions/payroll";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  unmatchedFlipCount: number;
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
  unmatchedFlipCount,
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

  const [recap, setRecap] = useState<PayrollRecapItem[]>(payrollRecap);
  const [recapOffset, setRecapOffset] = useState<number>(0);
  const [isRecapPending, startRecapTransition] = useTransition();

  // Chart view mode: 'daily' | 'weekly' | 'monthly'
  const [chartMode, setChartMode] = useState<"daily" | "weekly" | "monthly">("daily");

  function handleRecapOffsetChange(val: string) {
    const offset = Number(val);
    setRecapOffset(offset);
    startRecapTransition(async () => {
      try {
        const data = await getPayrollRecap(offset);
        setRecap(data);
      } catch (err) {
        toast.error("Gagal memuat rekap absensi");
      }
    });
  }

  function handlePreset(days: number) {
    const end = new Date();
    const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: timezone });
    const e = fmt(end);

    if (days === 9999) {
      // Semua (All Time)
      const s = "2020-01-01";
      setStartDate(s);
      setEndDate(e);
      fetchStats(s, e);
      return;
    }

    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const s = fmt(start);
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

  const {
    summary,
    daily = [],
    weekly = [],
    monthly = [],
    weekdayVsWeekend = {
      weekday: { shiftCount: 0, totalOmzet: 0, avgOmzetPerShift: 0, omzetCash: 0, omzetDebit: 0, cashPercent: 0, debitPercent: 0, digitalProfit: 0 },
      weekend: { shiftCount: 0, totalOmzet: 0, avgOmzetPerShift: 0, omzetCash: 0, omzetDebit: 0, cashPercent: 0, debitPercent: 0, digitalProfit: 0 },
      weekendSurgePercent: 0,
      busiestDayName: "-",
      busiestDayOmzet: 0,
    },
    userPerformance = [],
    insights = [],
    consumerInsights = []
  } = stats;

  // Active chart data based on view mode
  const activeChartData =
    chartMode === "weekly"
      ? weekly.map((w) => ({
          label: w.weekLabel,
          omzetCash: w.omzetCash,
          omzetDebit: w.omzetDebit,
          expenditure: w.expenditure,
          digitalRevenue: w.digitalRevenue,
          digitalProfit: w.digitalProfit,
        }))
      : chartMode === "monthly"
      ? monthly.map((m) => ({
          label: m.monthLabel,
          omzetCash: m.omzetCash,
          omzetDebit: m.omzetDebit,
          expenditure: m.expenditure,
          digitalRevenue: m.digitalRevenue,
          digitalProfit: m.digitalProfit,
        }))
      : daily.map((d) => ({
          label: new Date(d.date + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          omzetCash: d.omzetCash,
          omzetDebit: d.omzetDebit,
          expenditure: d.expenditure,
          digitalRevenue: d.digitalRevenue,
          digitalProfit: d.digitalProfit,
        }));

  const userChartData = userPerformance.map((u) => ({
    name: u.userName.split(" ")[0],
    totalOmzet: u.totalOmzet,
    digitalProfit: u.digitalProfit,
    avgOmzet: u.avgOmzetPerShift,
  }));

  return (
    <div className="space-y-6">

      {/* ── Summary Cards Row 1 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Omzet Hari Ini" value={formatCurrency(summary.totalOmzet)} icon={DollarSign} colorClass="bg-chart-1/10 text-chart-1" />
        <SummaryCard title="Pegawai Aktif" value={String(activeAttendances.length)} icon={Users} colorClass="bg-chart-2/10 text-chart-2" subtext="Sedang bertugas saat ini" />
        <SummaryCard title="Menunggu Verifikasi" value={String(submittedCount)} icon={ClipboardCheck} colorClass="bg-amber-500/10 text-amber-500" />
        <SummaryCard title="Flip Belum Cocok" value={String(unmatchedFlipCount)} icon={AlertTriangle} colorClass="bg-destructive/10 text-destructive" />
      </div>

      {/* ── Filter Bar ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Hari Ini", days: 1 },
                { label: "7 Hari", days: 7 },
                { label: "30 Hari", days: 30 },
                { label: "90 Hari (3 Bulan)", days: 90 },
                { label: "Tahun Ini", days: 365 },
                { label: "Semua (All Time)", days: 9999 },
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

      {/* ── WEEKDAY VS WEEKEND & CONSUMER BEHAVIOR ANALYTICS ── */}
      <Card className="border border-indigo-500/20 shadow-sm rounded-2xl bg-gradient-to-br from-indigo-500/5 via-background to-purple-500/5">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-black tracking-tight">Analisa Pola Konsumsi Masyarakat (Weekday vs Weekend)</CardTitle>
                <CardDescription className="text-xs">
                  Perbandingan tren belanja hari kerja (Senin-Jumat) vs akhir pekan (Sabtu-Minggu) dan metode pembayaran favorit.
                </CardDescription>
              </div>
            </div>
            {weekdayVsWeekend.weekendSurgePercent !== 0 && (
              <Badge variant="outline" className={`border-indigo-500/30 text-xs font-bold ${weekdayVsWeekend.weekendSurgePercent > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                {weekdayVsWeekend.weekendSurgePercent > 0 ? "🔥 Weekend Surge +" : "📉 Weekend "}
                {weekdayVsWeekend.weekendSurgePercent}%
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          {/* Weekday vs Weekend Comparison Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Weekday Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span className="font-bold text-sm">Hari Kerja (Weekday)</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Senin - Jumat ({weekdayVsWeekend.weekday.shiftCount} Shift)</Badge>
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{formatCurrency(weekdayVsWeekend.weekday.totalOmzet)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Rata-rata: <span className="font-bold">{formatCurrency(weekdayVsWeekend.weekday.avgOmzetPerShift)}</span>/shift</p>
              </div>
              <div className="space-y-1.5 pt-2 border-t text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Metode Pembayaran</span>
                  <span className="font-bold text-foreground">Cash {weekdayVsWeekend.weekday.cashPercent}% vs Debit {weekdayVsWeekend.weekday.debitPercent}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="bg-blue-500 h-full" style={{ width: `${weekdayVsWeekend.weekday.cashPercent}%` }} />
                  <div className="bg-purple-500 h-full" style={{ width: `${weekdayVsWeekend.weekday.debitPercent}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Laba Digital Disumbang</span>
                  <span className="font-bold text-teal-600">+{formatCurrency(weekdayVsWeekend.weekday.digitalProfit)}</span>
                </div>
              </div>
            </div>

            {/* Weekend Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  <span className="font-bold text-sm">Akhir Pekan (Weekend)</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Sabtu - Minggu ({weekdayVsWeekend.weekend.shiftCount} Shift)</Badge>
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{formatCurrency(weekdayVsWeekend.weekend.totalOmzet)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Rata-rata: <span className="font-bold">{formatCurrency(weekdayVsWeekend.weekend.avgOmzetPerShift)}</span>/shift</p>
              </div>
              <div className="space-y-1.5 pt-2 border-t text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Metode Pembayaran</span>
                  <span className="font-bold text-foreground">Cash {weekdayVsWeekend.weekend.cashPercent}% vs Debit {weekdayVsWeekend.weekend.debitPercent}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="bg-blue-500 h-full" style={{ width: `${weekdayVsWeekend.weekend.cashPercent}%` }} />
                  <div className="bg-purple-500 h-full" style={{ width: `${weekdayVsWeekend.weekend.debitPercent}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Laba Digital Disumbang</span>
                  <span className="font-bold text-teal-600">+{formatCurrency(weekdayVsWeekend.weekend.digitalProfit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consumer Behavior Narrative Cards */}
          {consumerInsights.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {consumerInsights.map((ci) => (
                <div key={ci.id} className="p-3.5 rounded-xl border bg-background/80 space-y-1">
                  <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    {ci.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ci.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SMART BUSINESS INSIGHTS & SALES OPPORTUNITIES ── */}
      {insights.length > 0 && (
        <Card className="border border-amber-500/20 shadow-sm bg-gradient-to-br from-amber-500/5 via-background to-emerald-500/5 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black tracking-tight">Rekomendasi Strategis Peningkatan Penjualan</CardTitle>
                  <CardDescription className="text-xs">
                    Analisa otomatis berbasis data transaksi & performa pegawai pada periode terpilih.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
                Smart Analytics
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-3 md:grid-cols-2">
            {insights.map((ins) => {
              const bgClass =
                ins.type === "success"
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
                  : ins.type === "opportunity"
                  ? "bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20"
                  : ins.type === "warning"
                  ? "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20"
                  : "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20";

              const IconComponent =
                ins.type === "success"
                  ? Trophy
                  : ins.type === "opportunity"
                  ? Target
                  : ins.type === "warning"
                  ? ShieldAlert
                  : Lightbulb;

              return (
                <div key={ins.id} className={`p-4 rounded-xl border ${bgClass} space-y-1.5 transition hover:shadow-xs`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <IconComponent className="h-4 w-4 shrink-0" />
                    <span>{ins.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90 font-medium">
                    {ins.description}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── USER PERFORMANCE TREND & ANALYTICS ── */}
      <Card className="border border-border/80 shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black tracking-tight">Analisa Trend Per User & Produktivitas Kasir</CardTitle>
                <CardDescription className="text-xs">
                  Evaluasi omzet, kontribusi laba digital, dan akurasi kas dari setiap pembuat laporan.
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto font-bold text-xs px-3 py-1">
              {userPerformance.length} Pegawai Terlibat
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          {userPerformance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs font-medium">
              Belum ada data transaksi/laporan pegawai pada periode ini.
            </div>
          ) : (
            <>
              {/* User Performance Chart */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border shadow-none bg-muted/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Total Omzet vs Laba Digital Per Kasir
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={userChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CurrencyTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="totalOmzet" name="Omzet POS" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="digitalProfit" name="Laba Digital" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border shadow-none bg-muted/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Rata-Rata Omzet Per Shift (Produktivitas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={userChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CurrencyTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="avgOmzet" name="Rata-rata/Shift" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* User Performance Leaderboard Table */}
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs font-bold uppercase tracking-wider">
                      <TableHead className="pl-4">Nama Pegawai</TableHead>
                      <TableHead className="text-center">Shift</TableHead>
                      <TableHead className="text-right">Total Omzet</TableHead>
                      <TableHead className="text-right">Omzet Debit</TableHead>
                      <TableHead className="text-right">Rata-rata/Shift</TableHead>
                      <TableHead className="text-right">Laba Digital</TableHead>
                      <TableHead className="text-center">Produk Digital Favorit</TableHead>
                      <TableHead className="text-right pr-4">Akurasi Kas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userPerformance.map((u, index) => {
                      const debitPct = u.totalOmzet > 0 ? Math.round((u.omzetDebit / u.totalOmzet) * 100) : 0;
                      return (
                        <TableRow key={u.userId} className="hover:bg-muted/10 transition">
                          <TableCell className="font-bold pl-4">
                            <div className="flex items-center gap-2">
                              {index === 0 ? (
                                <span className="text-amber-500 font-extrabold text-sm">🥇</span>
                              ) : index === 1 ? (
                                <span className="text-slate-400 font-extrabold text-sm">🥈</span>
                              ) : index === 2 ? (
                                <span className="text-amber-700 font-extrabold text-sm">🥉</span>
                              ) : (
                                <span className="text-xs text-muted-foreground w-4 text-center font-mono">{index + 1}</span>
                              )}
                              <div>
                                <p className="text-sm font-extrabold tracking-tight">{u.userName}</p>
                                <Badge variant="secondary" className="text-[9px] py-0 h-4 font-semibold capitalize">
                                  {getRoleLabel(u.userRole)}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-xs">
                            {u.shiftCount} <span className="text-[10px] text-muted-foreground font-normal">shift</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(u.totalOmzet)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                            <div>
                              <span>{formatCurrency(u.omzetDebit)}</span>
                              <span className="block text-[10px] font-normal text-muted-foreground">({debitPct}%)</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(u.avgOmzetPerShift)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                            +{formatCurrency(u.digitalProfit)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">
                              {u.topDigitalService}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex flex-col items-end">
                              <span className={`text-xs font-black ${u.accuracyRate >= 90 ? "text-emerald-600" : u.accuracyRate >= 80 ? "text-amber-600" : "text-rose-600"}`}>
                                {u.accuracyRate}%
                              </span>
                              {u.totalVariance !== 0 && (
                                <span className={`text-[10px] font-mono ${u.totalVariance < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                                  ({u.totalVariance > 0 ? "+" : ""}{formatCurrency(u.totalVariance)})
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── CHARTS WITH MULTI-PERSPECTIVE TOGGLE (DAILY / WEEKLY / MONTHLY) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-bold tracking-tight">Grafik Growth & Trend Penjualan</h3>
          <div className="flex gap-1.5 bg-muted p-1 rounded-xl">
            <Button
              size="sm"
              variant={chartMode === "daily" ? "default" : "ghost"}
              onClick={() => setChartMode("daily")}
              className="text-xs h-7 rounded-lg"
            >
              Harian (Daily)
            </Button>
            <Button
              size="sm"
              variant={chartMode === "weekly" ? "default" : "ghost"}
              onClick={() => setChartMode("weekly")}
              className="text-xs h-7 rounded-lg"
            >
              Per Minggu (Weekly)
            </Button>
            <Button
              size="sm"
              variant={chartMode === "monthly" ? "default" : "ghost"}
              onClick={() => setChartMode("monthly")}
              className="text-xs h-7 rounded-lg"
            >
              Per Bulan (Monthly)
            </Button>
          </div>
        </div>

        {activeChartData.length === 0 ? (
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
                <CardTitle className="text-sm font-semibold">
                  Omzet Cash vs Debit ({chartMode === "weekly" ? "Per Minggu" : chartMode === "monthly" ? "Per Bulan" : "Harian"})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={activeChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                <CardTitle className="text-sm font-semibold">
                  Pengeluaran Toko ({chartMode === "weekly" ? "Per Minggu" : chartMode === "monthly" ? "Per Bulan" : "Harian"})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={activeChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                <CardTitle className="text-sm font-semibold">
                  Pendapatan & Laba Digital ({chartMode === "weekly" ? "Per Minggu" : chartMode === "monthly" ? "Per Bulan" : "Harian"})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={activeChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
      </div>

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
              <div className="space-y-1">
                <CardTitle className="text-base">Rekap Absensi</CardTitle>
                <p className="text-xs text-muted-foreground">Siklus Gaji Pegawai</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={String(recapOffset)}
                  onValueChange={handleRecapOffsetChange}
                  disabled={isRecapPending}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih Periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Periode Berjalan</SelectItem>
                    <SelectItem value="-1">1 Periode Lalu</SelectItem>
                    <SelectItem value="-2">2 Periode Lalu</SelectItem>
                    <SelectItem value="-3">3 Periode Lalu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {recap.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Tidak ada data pegawai</p>
            ) : (
              <div className={`transition-opacity duration-200 ${isRecapPending ? "opacity-50 pointer-events-none" : ""}`}>
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
                    {recap.map((item) => (
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
              </div>
            )}
            {isRecapPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/30 backdrop-blur-[1px] rounded-b-xl">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
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
