"use client";

import { useState, useMemo } from "react";
import { getAdminAttendanceHistory } from "@/app/actions/attendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  History, 
  Users, 
  Search, 
  CalendarDays, 
  User as UserIcon, 
  Clock, 
  FilterX, 
  LayoutGrid, 
  List,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  initialLogs: any[];
  initialShiftSettings: any[];
  employees: any[];
  timezone: string;
  initialMonth: number;
  initialYear: number;
}

export function AttendanceHistoryClient({ 
  initialLogs, 
  initialShiftSettings, 
  employees, 
  timezone,
  initialMonth,
  initialYear 
}: Props) {
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [filters, setFilters] = useState({
    userId: "all",
    month: initialMonth,
    year: initialYear
  });
  const [isLoading, setIsLoading] = useState(false);

  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  const years = [initialYear - 1, initialYear, initialYear + 1];

  async function handleSearch() {
    setIsLoading(true);
    try {
      const res: any = await getAdminAttendanceHistory(filters);
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        toast.success("Data berhasil dimuat");
      } else {
        toast.error(res.error || "Gagal mengambil data");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsLoading(false);
    }
  }

  function resetFilters() {
    setFilters({ userId: "all", month: initialMonth, year: initialYear });
  }

  // Grouping logic for Formation View: Date -> Shift
  const dailyFormations = useMemo(() => {
    const daily: Record<string, Record<string, any[]>> = {};
    
    // Sort logs chronologically for the formation view
    const sortedLogs = [...logs].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());

    sortedLogs.forEach(log => {
      const dateKey = new Date(log.clockIn).toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
      const shiftName = log.shiftType;

      if (!daily[dateKey]) daily[dateKey] = {};
      
      // Pre-initialize shifts from settings for each date (cleaner look)
      if (Object.keys(daily[dateKey]).length === 0) {
        initialShiftSettings.forEach(s => {
            daily[dateKey][s.name] = [];
        });
      }

      if (!daily[dateKey][shiftName]) daily[dateKey][shiftName] = [];
      daily[dateKey][shiftName].push(log);
    });

    // Convert to sorted array
    return Object.entries(daily)
      .sort((a, b) => b[0].localeCompare(a[0])) // Descending dates
      .map(([date, shifts]) => ({
        date,
        shifts: Object.entries(shifts).filter(([_, members]) => members.length > 0) // Only show shifts with people
      }));
  }, [logs, initialShiftSettings, timezone]);

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-5 duration-1000">
      {/* Header with Visual Polish */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider animate-pulse">
            <Sparkles className="h-3 w-3" /> Rekap Monitoring
          </div>
          <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
            Riwayat Absensi
          </h1>
          <p className="text-muted-foreground font-medium max-w-md">
            Pantau kehadiran, distribusi tim, dan performa pegawai dalam periode bulanan.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-3xl border border-border/50 shadow-sm">
           <div className="text-right">
              <p className="text-[10px] uppercase font-black text-muted-foreground leading-none">Status Database</p>
              <p className="text-sm font-bold text-emerald-500">Terhubung & Sinkron</p>
           </div>
           <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center">
             <History className="h-6 w-6 text-primary" />
           </div>
        </div>
      </div>

      {/* Modern Filter Card */}
      <Card className="border-0 shadow-2xl bg-card/40 backdrop-blur-xl overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        <CardContent className="p-8">
          <div className="grid gap-6 md:grid-cols-4 items-end">
            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <UserIcon className="h-3.5 w-3.5 text-primary" /> Pilih Pegawai
              </label>
              <Select 
                value={filters.userId} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, userId: v }))}
              >
                <SelectTrigger className="h-12 rounded-2xl border-border/50 bg-background/50 focus:ring-primary/20 transition-all">
                  <SelectValue placeholder="Semua Pegawai" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="all">Semua Pegawai</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Bulan
              </label>
              <Select 
                value={filters.month.toString()} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, month: parseInt(v) }))}
              >
                <SelectTrigger className="h-12 rounded-2xl border-border/50 bg-background/50 focus:ring-primary/20 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Tahun
              </label>
              <Select 
                value={filters.year.toString()} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, year: parseInt(v) }))}
              >
                <SelectTrigger className="h-12 rounded-2xl border-border/50 bg-background/50 focus:ring-primary/20 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={isLoading}
                className="h-12 flex-1 rounded-2xl font-bold gap-2 shadow-xl shadow-primary/20 bg-primary hover:scale-[1.02] transition-transform active:scale-[0.98]"
              >
                {isLoading ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 
                Tampilkan Data
              </Button>
              <Button 
                variant="outline" 
                onClick={resetFilters}
                className="h-12 w-12 rounded-2xl border-border/50 hover:bg-muted"
                title="Reset Filter"
              >
                <FilterX className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="formation" className="space-y-8">
        <div className="flex justify-center">
            <TabsList className="bg-card/40 backdrop-blur-md border border-border/50 p-1.5 rounded-[2rem] h-auto shadow-sm">
                <TabsTrigger value="formation" className="rounded-3xl px-8 py-3 font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300">
                    <LayoutGrid className="h-4 w-4" /> Formasi Tim Harian
                </TabsTrigger>
                <TabsTrigger value="list" className="rounded-3xl px-8 py-3 font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300">
                    <List className="h-4 w-4" /> Log Detail Bulanan
                </TabsTrigger>
            </TabsList>
        </div>

        {/* Formation View: Chronological Dates */}
        <TabsContent value="formation" className="space-y-12 mt-0 focus-visible:outline-none focus-visible:ring-0">
          {dailyFormations.length === 0 ? (
            <Card className="border-dashed border-2 bg-transparent py-20">
                <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-muted rounded-full">
                        <Users className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-lg">Tidak Ada Data</p>
                        <p className="text-sm text-muted-foreground">Silakan pilih bulan yang memiliki riwayat aktivitas.</p>
                    </div>
                </CardContent>
            </Card>
          ) : (
            dailyFormations.map(({ date, shifts }) => (
                <div key={date} className="space-y-6 relative">
                    <div className="sticky top-0 z-10 py-2">
                        <div className="flex items-center gap-4 bg-background/80 backdrop-blur-lg w-max pr-6 rounded-full border border-border/50 shadow-sm">
                            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-lg">
                                {new Date(date).getDate()}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black uppercase tracking-wider">
                                    {new Date(date).toLocaleDateString("id-ID", { weekday: 'long' })}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">
                                    {new Date(date).toLocaleDateString("id-ID", { month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pl-6 border-l-2 border-primary/10 ml-6">
                        {shifts.map(([shiftName, members]) => (
                            <Card key={shiftName} className="border-0 shadow-lg bg-card/60 ring-1 ring-white/5 hover:ring-primary/30 transition-all group rounded-3xl overflow-hidden">
                                <CardHeader className="pb-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-black flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            {shiftName}
                                        </CardTitle>
                                        <Badge className="bg-primary/10 text-primary border-primary/20 rounded-lg">
                                            {members.length} Orang
                                        </Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-2 font-bold text-xs italic">
                                        <Clock className="h-3 w-3" />
                                        {initialShiftSettings.find(s => s.name === shiftName)?.startTime || "--:--"} - {initialShiftSettings.find(s => s.name === shiftName)?.endTime || "--:--"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 pt-5">
                                    <div className="space-y-3">
                                        {members.map(log => (
                                            <div key={log.id} className="group/item flex items-center justify-between p-3.5 rounded-2xl bg-background/50 border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                                                        <UserIcon className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-foreground group-hover/item:text-primary transition-colors">
                                                            {log.user.name}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground group-hover/item:bg-primary/10 transition-colors">
                                                                {log.user.role}
                                                            </span>
                                                            {log.actingAsCashier && (
                                                                <span className="text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                                                    KASIR
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                        {formatTime(log.clockIn, timezone)}
                                                    </div>
                                                    {log.clockOut ? (
                                                        <div className="text-[10px] font-black text-rose-500 flex items-center justify-end gap-1">
                                                            <ChevronRight className="h-2 w-2" /> {formatTime(log.clockOut, timezone)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[9px] font-black text-amber-500 uppercase flex items-center justify-end gap-1">
                                                            <div className="h-1 w-1 rounded-full bg-amber-500 animate-ping" /> AKTIF
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))
          )}
        </TabsContent>

        {/* List View: Premium Table */}
        <TabsContent value="list" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <Card className="border-0 shadow-2xl overflow-hidden bg-card/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[2rem]">
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-border/50 h-16">
                        <TableHead className="font-black text-xs uppercase tracking-widest pl-8">Tanggal</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest">Pegawai</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest">Shift</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest text-emerald-600">Jam Masuk</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest text-rose-500">Jam Pulang</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest text-center">Status</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {logs.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={6} className="text-center py-32 text-muted-foreground italic font-medium">
                            Tidak ada riwayat untuk periode ini.
                        </TableCell>
                        </TableRow>
                    ) : (
                        logs.map(log => (
                            <TableRow key={log.id} className="border-border/20 hover:bg-primary/5 transition-all group h-16">
                            <TableCell className="pl-8">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">
                                         {new Date(log.clockIn).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-black uppercase">
                                         {new Date(log.clockIn).toLocaleDateString("id-ID", { weekday: 'short' })}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                        {log.user.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold group-hover:text-primary transition-colors">{log.user.name}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{log.user.role}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="bg-background/80 border border-border/50 text-[10px] font-black uppercase tracking-tight px-2">
                                    {log.shiftType}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm font-black text-emerald-600">
                                {formatTime(log.clockIn, timezone)}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-black text-rose-500">
                                {log.clockOut ? formatTime(log.clockOut, timezone) : "--:--"}
                            </TableCell>
                            <TableCell className="text-center">
                                {log.clockOut ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none text-[10px] font-black uppercase">Selesai</Badge>
                                ) : (
                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none text-[10px] font-black uppercase animate-pulse">Bertugas</Badge>
                                )}
                            </TableCell>
                            </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
