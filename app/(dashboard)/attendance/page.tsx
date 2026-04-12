"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  LogIn,
  LogOut,
  Timer,
  UserCheck,
} from "lucide-react";
import {
  attendances as mockAttendances,
  formatTime,
  getRoleLabel,
  type ShiftType,
} from "@/lib/mock-data";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { 
  getActiveAttendance, 
  checkIn, 
  clockOut, 
  getTodayAttendanceLog 
} from "@/app/actions/attendance";
import { getAvailableShifts } from "@/app/actions/attendance-shifts";

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [shiftType, setShiftType] = useState<ShiftType>("Pagi");
  const [actingAsCashier, setActingAsCashier] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial sync with retry logic
  useEffect(() => {
    if (status !== "authenticated") return;

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    async function sync(isRetry = false) {
      if (isRetry) {
        console.log(`Menghubungkan kembali... (Percobaan ${retryCount}/${maxRetries})`);
      }

      try {
        const [active, logs, shifts] = await Promise.all([
          getActiveAttendance(),
          getTodayAttendanceLog(),
          getAvailableShifts()
        ]);

        if (active) {
          setIsClockedIn(true);
          setClockInTime(new Date(active.clockIn));
          setShiftType(active.shiftType);
          setActingAsCashier(active.actingAsCashier);
          setActiveId(active.id);
        }

        setTodayLogs(logs);
        setAvailableShifts(shifts);
        
        // Default to first available shift if not clocked in
        if (!active && shifts.length > 0) {
          setShiftType(shifts[0].name);
        } else if (!active && shifts.length === 0) {
           // Fallback if DB empty (should not happen after admin setup)
           setShiftType("Pagi");
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Attendance Sync Error:", err);
        
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => sync(true), retryDelay);
        } else {
          toast.error("Gagal sinkronisasi data presensi.");
          setIsLoading(false);
        }
      }
    }

    sync();
  }, [status]);

  // Elapsed timer
  useEffect(() => {
    if (!isClockedIn || !clockInTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - clockInTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockedIn, clockInTime]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleClockIn = async () => {
    try {
      const att = await checkIn({ shiftType, actingAsCashier });
      setIsClockedIn(true);
      setClockInTime(new Date(att.clockIn));
      setActiveId(att.id);
      setElapsedSeconds(0);
      toast.success("Clock-In berhasil!", {
        description: `Shift ${shiftType} dimulai.${actingAsCashier ? " (Login sebagai Kasir)" : ""}`,
      });
      // Refresh logs
      const logs = await getTodayAttendanceLog();
      setTodayLogs(logs);
    } catch (err: any) {
      toast.error(err.message || "Gagal Clock-In");
    }
  };

  const handleClockOut = async () => {
    if (!activeId) return;
    try {
      await clockOut(activeId);
      setIsClockedIn(false);
      setActiveId(null);
      toast.success("Clock-Out berhasil!", {
        description: `Durasi kerja: ${formatElapsed(elapsedSeconds)}`,
      });
      // Refresh logs
      const logs = await getTodayAttendanceLog();
      setTodayLogs(logs);
    } catch (err) {
      toast.error("Gagal Clock-Out");
    }
  };

  if (isLoading) {
      return (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="animate-pulse">Sinkronisasi data presensi...</p>
          </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Clock Display */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-8 text-center">
          <p className="text-sm text-muted-foreground mb-1">Waktu Sekarang</p>
          <p className="text-5xl font-bold tracking-tight font-mono tabular-nums">
            {currentTime.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <CardContent className="p-6">
          {!isClockedIn ? (
            <div className="space-y-5">
              {/* Shift selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Shift</label>
                <Select value={shiftType} onValueChange={(v) => setShiftType(v)}>
                  <SelectTrigger className="h-12 text-base bg-background/50 border-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.length > 0 ? (
                        availableShifts.map((s) => (
                          <SelectItem key={s.id} value={s.name}>
                             {s.name.toLowerCase().includes("pagi") ? "☀️" : 
                              s.name.toLowerCase().includes("malam") ? "🌙" : "⏰"} 
                             {" "} {s.name} ({s.startTime} - {s.endTime})
                          </SelectItem>
                        ))
                    ) : (
                        <>
                            <SelectItem value="Pagi">☀️ Shift Pagi (07:00 - 14:30)</SelectItem>
                            <SelectItem value="Malam">🌙 Shift Malam (14:30 - 22:00)</SelectItem>
                        </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Override role */}
              <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
                <input
                  type="checkbox"
                  id="acting-cashier"
                  checked={actingAsCashier}
                  onChange={(e) => setActingAsCashier(e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <label htmlFor="acting-cashier" className="text-sm cursor-pointer">
                  <span className="font-medium">Login Sebagai Kasir Hari Ini</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Centang jika Anda pramuniaga yang menggantikan shift kasir
                  </p>
                </label>
              </div>

              {/* Clock In button */}
              <Button
                size="lg"
                className="w-full h-14 text-lg font-semibold"
                onClick={handleClockIn}
              >
                <LogIn className="mr-2 h-5 w-5" />
                Clock-In
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status */}
              <div className="flex items-center justify-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Sedang bertugas — Shift {shiftType}
                </span>
                {actingAsCashier && (
                  <Badge variant="secondary" className="text-xs">
                    <UserCheck className="mr-1 h-3 w-3" />
                    Kasir
                  </Badge>
                )}
              </div>

              {/* Timer */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Durasi Kerja</p>
                <div className="flex items-center justify-center gap-2">
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="text-4xl font-bold font-mono tabular-nums tracking-tight">
                    {formatElapsed(elapsedSeconds)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Clock-in: {clockInTime?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Clock Out button */}
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-14 text-lg font-semibold"
                onClick={handleClockOut}
              >
                <LogOut className="mr-2 h-5 w-5" />
                Clock-Out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Attendance Log */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Log Presensi Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Clock-In</TableHead>
                <TableHead>Clock-Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayLogs.map((att) => (
                <TableRow key={att.id}>
                  <TableCell className="font-medium">{att.user?.name || "User"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getRoleLabel(att.user?.role as any)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {att.shiftType === "Pagi" ? "☀️" : "🌙"} {att.shiftType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {new Date(att.clockIn).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {att.clockOut 
                        ? new Date(att.clockOut).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) 
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {att.clockOut ? (
                      <Badge variant="secondary" className="text-xs">Selesai</Badge>
                    ) : (
                      <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Aktif
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {todayLogs.length === 0 && !isLoading && (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          Belum ada aktivitas presensi hari ini.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
