"use client";

import { useState, useMemo } from "react";
import { getAdminAttendanceHistory } from "@/app/actions/attendance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  History, 
  Users, 
  Search, 
  Calendar, 
  User as UserIcon, 
  Clock, 
  FilterX, 
  LayoutGrid, 
  List
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  initialLogs: any[];
  initialShiftSettings: any[];
  employees: any[];
  timezone: string;
  initialDate: string;
}

export function AttendanceHistoryClient({ 
  initialLogs, 
  initialShiftSettings, 
  employees, 
  timezone,
  initialDate 
}: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [filters, setFilters] = useState({
    userId: "all",
    date: initialDate
  });
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch() {
    setIsLoading(true);
    try {
      const res = await getAdminAttendanceHistory(filters);
      if (res.success && res.data) {
        setLogs(res.data.logs);
        toast.success("Data diperbarui");
      } else {
        toast.error("Gagal mengambil data");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }

  function resetFilters() {
    setFilters({ userId: "all", date: initialDate });
  }

  // Formation grouping logic
  const formations = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    // Initialize groups with shift names from settings
    initialShiftSettings.forEach(shift => {
      groups[shift.name] = [];
    });
    
    // Add "Lainnya" group for logs that don't match any shift name if needed,
    // but typically they will match if they used the setup.
    // Grouping by log.shiftType
    logs.forEach(log => {
      const shiftName = log.shiftType;
      if (!groups[shiftName]) groups[shiftName] = [];
      groups[shiftName].push(log);
    });

    return groups;
  }, [logs, initialShiftSettings]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">Riwayat Absensi</h1>
          <p className="text-muted-foreground font-medium">Pantau kehadiran dan formasi tim harian.</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-2xl hidden md:block">
          <History className="h-8 w-8 text-primary" />
        </div>
      </div>

      {/* Filter Section */}
      <Card className="border-0 shadow-lg bg-card/60 backdrop-blur-md">
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" /> Pegawai
              </label>
              <Select 
                value={filters.userId} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, userId: v }))}
              >
                <SelectTrigger className="rounded-xl border-border/50 bg-background/50">
                  <SelectValue placeholder="Semua Pegawai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pegawai</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Tanggal
              </label>
              <Input 
                type="date" 
                className="rounded-xl border-border/50 bg-background/50" 
                value={filters.date}
                onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={isLoading}
                className="flex-1 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
              >
                <Search className="h-4 w-4" /> Cari
              </Button>
              <Button 
                variant="outline" 
                onClick={resetFilters}
                className="rounded-xl border-border/50"
              >
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="formation" className="space-y-6">
        <div className="flex justify-center">
            <TabsList className="bg-background/50 border border-border/50 p-1 rounded-2xl h-auto">
                <TabsTrigger value="formation" className="rounded-xl px-6 py-2.5 font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <LayoutGrid className="h-4 w-4" /> Formasi Tim
                </TabsTrigger>
                <TabsTrigger value="list" className="rounded-xl px-6 py-2.5 font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <List className="h-4 w-4" /> Log Detail
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="formation" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {Object.entries(formations).map(([shiftName, members]) => (
                <Card key={shiftName} className="border-0 shadow-md bg-card/40 hover:shadow-xl transition-all border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-black">{shiftName}</CardTitle>
                        <Badge variant="secondary" className="font-bold">{members.length} Orang</Badge>
                    </div>
                    {initialShiftSettings.find(s => s.name === shiftName) && (
                        <CardDescription className="flex items-center gap-1 font-medium italic">
                            <Clock className="h-3 w-3" /> 
                            {initialShiftSettings.find(s => s.name === shiftName)?.startTime} - {initialShiftSettings.find(s => s.name === shiftName)?.endTime}
                        </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {members.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-4">Tidak ada yang hadir di shift ini.</p>
                    ) : (
                        <ul className="space-y-3">
                            {members.map(log => (
                                <li key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-background/40 border border-border/30">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Users className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold leading-none">{log.user.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{log.user.role}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                            {formatTime(log.clockIn, timezone)}
                                        </div>
                                        {log.clockOut && (
                                            <div className="text-[10px] font-black text-rose-500 mt-0.5">
                                               - {formatTime(log.clockOut, timezone)}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                  </CardContent>
                </Card>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          <Card className="border-0 shadow-xl overflow-hidden bg-card/60 backdrop-blur-md">
            <CardContent className="p-0">
               <Table>
                 <TableHeader className="bg-muted/50">
                   <TableRow className="hover:bg-transparent border-border/50">
                     <TableHead className="font-bold">Tanggal</TableHead>
                     <TableHead className="font-bold">Nama</TableHead>
                     <TableHead className="font-bold">Shift</TableHead>
                     <TableHead className="font-bold text-emerald-600">Masuk</TableHead>
                     <TableHead className="font-bold text-rose-500">Pulang</TableHead>
                     <TableHead className="font-bold">Sebagai Kasir</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {logs.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                         Tidak ada data ditemukan.
                       </TableCell>
                     </TableRow>
                   ) : (
                     logs.map(log => (
                        <TableRow key={log.id} className="border-border/40 hover:bg-muted/30 transition-colors">
                          <TableCell className="text-sm font-medium">
                            {new Date(log.clockIn).toLocaleDateString("id-ID", {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                timeZone: timezone
                            })}
                          </TableCell>
                          <TableCell className="font-bold">{log.user.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-primary/5">{log.shiftType}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-emerald-600">
                             {formatTime(log.clockIn, timezone)}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-rose-500">
                             {log.clockOut ? formatTime(log.clockOut, timezone) : "-"}
                          </TableCell>
                          <TableCell>
                             {log.actingAsCashier ? (
                               <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shadow-none">Iya</Badge>
                             ) : (
                               <Badge variant="outline" className="text-muted-foreground shadow-none">Tidak</Badge>
                             )}
                          </TableCell>
                        </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
