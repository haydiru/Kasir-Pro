import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMyAttendanceHistory } from "@/app/actions/attendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, History, ArrowLeft, Coffee } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function AttendanceHistoryPage() {
  const session = await auth();
  if (!session?.user) return null;

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  const res = await getMyAttendanceHistory();
  const logs = res.success ? res.data : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/dashboard" className="text-sm text-primary flex items-center gap-1 hover:underline mb-2">
            <ArrowLeft className="h-3 w-3" /> Kembali ke Dashboard
          </Link>
          <h1 className="text-3xl font-black tracking-tight">Riwayat Presensi</h1>
          <p className="text-muted-foreground font-medium">Data kehadiran Anda dalam 50 sesi terakhir.</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-2xl">
          <History className="h-8 w-8 text-primary" />
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Log Kehadiran Pribadi
          </CardTitle>
          <CardDescription>Menampilkan rincian jam masuk dan pulang Anda.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-4 bg-muted rounded-full">
                <Coffee className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-1 px-6">
                <h3 className="font-bold text-lg">Belum Ada Riwayat</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Belum ada catatan kehadiran untuk akun Anda. Silakan mulai bertugas untuk mencatat riwayat.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="font-bold">Tanggal</TableHead>
                    <TableHead className="font-bold">Shift</TableHead>
                    <TableHead className="font-bold text-emerald-600 dark:text-emerald-400">Jam Masuk</TableHead>
                    <TableHead className="font-bold text-rose-500">Jam Pulang</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id} className="border-border/40 hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-sm">
                        {new Date(log.clockIn).toLocaleDateString("id-ID", {
                           weekday: 'short',
                           day: 'numeric',
                           month: 'short',
                           year: 'numeric',
                           timeZone: timezone
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium bg-primary/5">
                           {log.shiftType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTime(log.clockIn, timezone)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.clockOut ? formatTime(log.clockOut, timezone) : "-"}
                      </TableCell>
                      <TableCell>
                        {log.clockOut ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none">
                            Selesai
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none animate-pulse">
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="p-6 rounded-2xl bg-gradient-to-br from-muted/50 to-muted border border-border/50 text-center">
        <p className="text-sm text-muted-foreground italic">
          Data riwayat ini digunakan sebagai acuan perhitungan gajian. Jika terdapat ketidaksesuaian, silakan hubungi Admin Toko.
        </p>
      </div>
    </div>
  );
}
