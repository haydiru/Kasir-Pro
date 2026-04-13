import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, ClipboardCheck, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getRoleLabel, formatCurrency, formatTime, calcExpectedCash, getTZDateRange } from "@/lib/utils";
import { getPayrollRecap } from "@/app/actions/payroll";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const storeId = session.user.storeId;

  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  // Fetch real data
  const activeAttendances = await prisma.attendance.findMany({
    where: { storeId, clockOut: null },
    include: { user: true }
  });

  const submittedReports = await prisma.shiftReport.findMany({
    where: { storeId, status: "Submitted" }
  });

  const verifiedReports = await prisma.shiftReport.findMany({
    where: { storeId, status: "Verified" },
    include: {
      user: true,
      store: true,
      digitalTransactions: true,
      expenditures: true
    },
    orderBy: { verifiedAt: 'desc' },
    take: 10
  });

  const payrollRecap = await getPayrollRecap();

  // Calculate today's basic stats correctly based on real reports from today
  const { start: todayStart } = getTZDateRange(new Date(), timezone);
  
  const todaysReports = await prisma.shiftReport.findMany({
    where: {
      storeId,
      date: { gte: todayStart }
    }
  });

  const todayRevenue = todaysReports.reduce((sum, r) => sum + r.posCash + r.posDebit, 0);
  const unmatchedFlip = 0; // Placeholder for now

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Omzet Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Omzet Hari Ini</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(todayRevenue)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-1/10">
                <DollarSign className="h-5 w-5 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pegawai Aktif Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pegawai Aktif</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{activeAttendances.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sedang bertugas saat ini</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-2/10">
                <Users className="h-5 w-5 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menunggu Verifikasi Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Menunggu Verifikasi</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{submittedReports.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10">
                <ClipboardCheck className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flip Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flip Belum Cocok</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{unmatchedFlip}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="border-0 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Statistik Omzet</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">
              Data belum cukup untuk menampilkan grafik.
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
                  <div key={att.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {att.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleLabel(att.user.role as any)} • Clock-in {formatTime(att.clockIn, timezone)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {att.shiftType}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Recap (Payroll Based) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Rekap Absensi (Periode Berjalan)</CardTitle>
            <Badge variant="secondary" className="font-normal text-xs">
              Berdasarkan Siklus Gaji Pegawai
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {payrollRecap.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Tidak ada data pegawai
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Pegawai</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Periode Aktif</TableHead>
                  <TableHead className="text-center">Hari Kerja</TableHead>
                  <TableHead className="text-center">Total Jam</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRecap.map((item) => (
                  <TableRow key={item.userId}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getRoleLabel(item.role)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="bg-primary/5 text-primary px-2 py-0.5 rounded text-xs font-medium">
                        {item.periodLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {item.totalDays} <span className="text-xs font-normal text-muted-foreground">hari</span>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {item.totalHours} <span className="text-xs font-normal text-muted-foreground">jam</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.isCurrentlyActive ? (
                        <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-500 font-medium">
                          <span className="relative flex h-2 w-2">
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          Sedang Bertugas
                        </div>
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
                  const expected = calcExpectedCash(report as any);
                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.user.name}</TableCell>
                      <TableCell>{report.date.toISOString().split("T")[0]}</TableCell>
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
