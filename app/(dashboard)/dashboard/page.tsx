import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/app/actions/dashboard";
import { getMyPayrollStats } from "@/app/actions/payroll";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Clock, 
  Smartphone, 
  Wallet, 
  ArrowRight, 
  ClipboardList, 
  UserCheck, 
  ShoppingBag,
  CalendarCheck,
  Timer,
  History
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDateTime, formatTime, getRoleLabel, getStatusColor } from "@/lib/utils";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Redirect admins to their specific dashboard
    if (session.user.role === "admin" || session.user.role === "super_admin") {
        redirect("/admin/dashboard");
    }

    const store = await prisma.store.findUnique({
        where: { id: session.user.storeId }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    const statsRes = await getDashboardData();
    const stats = statsRes.success ? statsRes.data : {
        attendance: null,
        digital: { count: 0, total: 0 },
        expenditure: { count: 0, total: 0 }
    };

    const payrollStats = await getMyPayrollStats();

    const isClockedIn = !!stats.attendance;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Hero Greeting */}
            <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-10 text-primary-foreground shadow-2xl">
                <div className="relative z-10 space-y-2">
                    <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                        Halo, {session.user.name}!
                    </h1>
                    <p className="text-primary-foreground/80 max-w-md font-medium">
                        {isClockedIn 
                            ? `Selamat bertugas di ${stats.attendance.shiftType}. Jangan lupa periksa setoran kasir!`
                            : "Anda belum mulai bertugas. Silakan lakukan absensi terlebih dahulu."}
                    </p>
                    <div className="pt-4">
                        {isClockedIn ? (
                            <Link href="/cashier/report">
                                <Button variant="secondary" size="lg" className="rounded-xl font-bold gap-2">
                                    <ClipboardList className="h-4 w-4" /> Buka Laporan Shift
                                </Button>
                            </Link>
                        ) : (
                            <Link href="/attendance">
                                <Button variant="secondary" size="lg" className="rounded-xl font-bold gap-2">
                                    <Clock className="h-4 w-4" /> Mulai Presensi
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
                {/* Abstract backgrounds */}
                <div className="absolute right-[-10%] top-[-20%] h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute left-[-5%] bottom-[-20%] h-48 w-48 rounded-full bg-accent/20 blur-2xl" />
                <BarChart3 className="absolute right-8 bottom-[-20px] h-48 w-48 text-white/5 -rotate-12 pointer-events-none" />
            </div>

            {/* Shift Status & Quick Stats */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Attendance Status */}
                <Card className="border-0 shadow-sm bg-background/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Status Presensi
                        </CardTitle>
                        {isClockedIn ? (
                            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                        ) : (
                            <div className="h-3 w-3 rounded-full bg-amber-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">
                            {isClockedIn ? "Aktif Bertugas" : "Belum Absen"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {isClockedIn 
                                ? `${stats.attendance.shiftType} — Masuk: ${formatTime(stats.attendance.clockIn, timezone)}` 
                                : "Segera lakukan clock-in"}
                        </p>
                    </CardContent>
                </Card>

                {/* Digital Revenue Today */}
                <Card className="border-0 shadow-sm bg-background/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Layanan Digital
                        </CardTitle>
                        <Smartphone className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{formatCurrency(stats.digital.total)}</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {stats.digital.count} entri yang Anda catat hari ini
                        </p>
                    </CardContent>
                </Card>

                {/* Expenditures Today */}
                <Card className="border-0 shadow-sm bg-background/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            Total Pengeluaran
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                             {formatCurrency(stats.expenditure.total)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {stats.expenditure.count} pengeluaran dicatat hari ini
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Payroll Progress Stats */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-primary" /> Statistik Periode ({payrollStats.periodLabel})
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm border border-primary/10">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Hari Kerja</p>
                                    <div className="text-3xl font-black">{payrollStats.totalDays} Hari</div>
                                </div>
                                <div className="p-3 bg-primary/20 rounded-2xl">
                                    <CalendarCheck className="h-8 w-8 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 backdrop-blur-sm border border-emerald-500/10">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Estimasi Jam Kerja</p>
                                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{payrollStats.totalHours} Jam</div>
                                </div>
                                <div className="p-3 bg-emerald-500/20 rounded-2xl">
                                    <Timer className="h-8 w-8 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Menu Shortcuts */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" /> Menu Utama
                </h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Link href="/cashier/report" className="group">
                        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <ClipboardList className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-bold">Input Laporan</span>
                        </div>
                    </Link>

                    <Link href="/attendance" className="group">
                        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1">
                            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-600">
                                <UserCheck className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-bold">Presensi Kerja</span>
                        </div>
                    </Link>

                    <Link href="/attendance/history" className="group">
                        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:bg-indigo-500 group-hover:text-white transition-colors text-indigo-600">
                                <History className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-bold">Riwayat Presensi</span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
