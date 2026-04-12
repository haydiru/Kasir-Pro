"use client";

import { useActionState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  PlusCircle, 
  Save, 
  Trash2, 
  Sunrise, 
  Sunset, 
  Calendar,
  Waves,
  Sparkles,
  ChevronRight,
  Loader2,
  Info
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateShiftSettings, addShiftSetting, deleteShiftSetting } from "@/app/actions/store";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: "all", label: "Setiap Hari", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "0", label: "Minggu", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  { value: "1", label: "Senin", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "2", label: "Selasa", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "3", label: "Rabu", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "4", label: "Kamis", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "5", label: "Jumat", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "6", label: "Sabtu", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
];

export default function ShiftClientActions({ shifts, storeId }: { shifts: any[], storeId: string }) {
  const [state, formAction, isPending] = useActionState(updateShiftSettings, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const handleAdd = async () => {
    const res = await addShiftSetting(storeId);
    if (res.error) toast.error(res.error);
    else toast.success("Shift baru ditambahkan. Klik simpan untuk menerapkan.");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus jadwal shift ini?")) return;
    const res = await deleteShiftSetting(id);
    if (res.error) toast.error(res.error);
    else toast.success("Shift berhasil dihapus.");
  };

  return (
    <Card className="border-none shadow-xl bg-card/40 backdrop-blur-xl overflow-hidden ring-1 ring-white/10">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none rotate-12">
        <Clock className="h-40 w-40 text-primary" />
      </div>
      
      <form action={formAction}>
        <CardHeader className="pb-6 border-b border-primary/5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                Jadwal Operasional
              </CardTitle>
              <CardDescription className="text-sm">
                Kelola jam kerja harian dan jadwal khusus (seperti akhir pekan).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6 bg-gradient-to-b from-transparent to-primary/5">
          {shifts.length === 0 ? (
             <div className="text-center py-16 border-2 border-dashed rounded-3xl border-primary/20 bg-primary/5 flex flex-col items-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Calendar className="h-8 w-8 text-primary/40" />
                </div>
                <p className="text-base font-medium text-muted-foreground mb-1">Daftar shift masih kosong</p>
                <p className="text-sm text-muted-foreground/60 mb-6 max-w-[240px]">Tambahkan shift pertama untuk mengaktifkan sistem presensi.</p>
                <Button type="button" onClick={handleAdd} className="rounded-full px-8">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Tambah Shift
                </Button>
             </div>
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => {
                const isMorning = shift.name.toLowerCase().includes("pagi");
                const isNight = shift.name.toLowerCase().includes("malam");
                const currentDay = DAYS.find(d => d.value === (shift.dayOfWeek?.toString() || "all"));
                
                return (
                  <div 
                    key={shift.id} 
                    className={cn(
                      "group relative flex flex-col lg:flex-row gap-6 p-6 rounded-3xl transition-all duration-300 border bg-background/50",
                      isMorning ? "hover:border-orange-500/30 hover:bg-orange-500/5" : 
                      isNight ? "hover:border-indigo-500/30 hover:bg-indigo-500/5" : 
                      "hover:border-primary/30 hover:bg-primary/5",
                      "border-primary/5 shadow-sm hover:shadow-xl"
                    )}
                  >
                    <input type="hidden" name="shiftId" value={shift.id} />
                    
                    <div className="flex-1 space-y-4">
                      {/* Top row: Name and Day */}
                      <div className="flex flex-col md:flex-row items-center gap-4">
                         <div className="relative flex-1 w-full">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 block px-1">
                              Nama Shift
                            </Label>
                            <div className="relative">
                              <Input 
                                name="shiftName" 
                                defaultValue={shift.name} 
                                className="h-11 bg-background border-primary/10 focus-visible:ring-primary font-semibold pl-10 rounded-xl" 
                                placeholder="Contoh: Shift Pagi"
                                required 
                              />
                              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                {isMorning ? <Sunrise className="h-4 w-4 text-orange-500" /> : 
                                 isNight ? <Sunset className="h-4 w-4 text-indigo-500" /> : 
                                 <Waves className="h-4 w-4 text-primary" />}
                              </div>
                            </div>
                         </div>

                         <div className="w-full md:w-56">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 block px-1">
                              Hari Berlaku
                            </Label>
                            <Select name={`dayOfWeek_${shift.id}`} defaultValue={shift.dayOfWeek?.toString() || "all"}>
                              <SelectTrigger className={cn("h-11 bg-background border-primary/10 rounded-xl font-medium", currentDay?.color)}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                                {DAYS.map((day) => (
                                  <SelectItem key={day.value} value={day.value} className="focus:bg-primary/10 focus:text-primary py-2.5">
                                    <div className="flex items-center gap-2">
                                      {day.value === "all" ? <Sparkles className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                                      {day.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                         </div>
                      </div>

                      {/* Bottom row: Times */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1 text-center md:text-left">
                          <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 block px-1">
                            Mulai
                          </Label>
                          <Input 
                            name="startTime" 
                            type="time" 
                            defaultValue={shift.startTime} 
                            className="h-11 bg-background/80 border-primary/10 focus-visible:ring-primary rounded-xl text-center md:text-left" 
                            required 
                          />
                        </div>
                        <div className="flex items-end pb-3 text-muted-foreground/30 hidden md:block">
                           <ChevronRight className="h-5 w-5" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5 block px-1">
                            Selesai
                          </Label>
                          <Input 
                            name="endTime" 
                            type="time" 
                            defaultValue={shift.endTime} 
                            className="h-11 bg-background/80 border-primary/10 focus-visible:ring-primary rounded-xl text-center md:text-left" 
                            required 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:flex-col justify-end gap-2 border-t lg:border-t-0 lg:border-l border-primary/5 pt-4 lg:pt-0 lg:pl-4">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all rounded-xl" 
                        onClick={() => handleDelete(shift.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button 
            type="button" 
            variant="outline" 
            className="w-full h-16 border-dashed border-2 bg-primary/2 hover:bg-primary/5 hover:border-primary/20 transition-all rounded-3xl group flex flex-col items-center justify-center space-y-0.5" 
            onClick={handleAdd}
          >
            <div className="flex items-center font-bold text-primary">
              <PlusCircle className="mr-2 h-5 w-5 group-hover:rotate-110 transition-transform duration-300" />
              <span>Tambah Shift Baru</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-medium tracking-tight">Atur jadwal khusus atau shift tambahan di sini</span>
          </Button>
        </CardContent>

        <CardFooter className="bg-background/80 py-6 border-t backdrop-blur-xl sticky bottom-0 z-10">
          <Button 
            type="submit" 
            disabled={isPending} 
            className="w-full md:w-auto md:ml-auto px-10 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/30 rounded-2xl font-bold transition-all active:scale-95 text-lg"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Menyimpan Perubahan...</span>
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
