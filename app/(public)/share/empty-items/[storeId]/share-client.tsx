"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Loader2,
  Check,
  User,
  Play,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";

interface EmptyItem {
  id: string;
  itemName: string;
  status: string; // 'BUTUH' | 'PROSES' | 'SELESAI'
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
  processor?: { name: string } | null;
}

interface Props {
  storeId: string;
  storeName: string;
  timezone: string;
}

export default function ShareClient({ storeId, storeName, timezone }: Props) {
  const [items, setItems] = useState<EmptyItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"AKTIF" | "SELESAI">("AKTIF");
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Status Action States
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // Fetch Items
  const fetchItems = async (showLoading = false) => {
    if (showLoading) setIsLoadingList(true);
    try {
      const res = await fetch(`/api/share/empty-items?storeId=${storeId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Gagal memuat daftar barang kosong:", error);
    } finally {
      if (showLoading) setIsLoadingList(false);
    }
  };

  // Polling 5 Detik
  useEffect(() => {
    fetchItems(true);

    const interval = setInterval(() => {
      fetchItems(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [storeId]);

  // Helper: Ekstrak Nama Pengambil Tugas dari Catatan
  const getProcessorName = (item: EmptyItem) => {
    if (item.processor) {
      return item.processor.name;
    }
    if (item.notes && item.notes.startsWith("[Diproses oleh: ")) {
      const match = item.notes.match(/^\[Diproses oleh: (.*?)\]/);
      if (match) return match[1];
    }
    return null;
  };

  // Helper: Ambil Catatan Asli tanpa Prefix Pemroses
  const getCleanNotes = (notes: string | null) => {
    if (!notes) return "";
    return notes.replace(/^\[Diproses oleh: (.*?)\]\s*/, "");
  };

  // Handler: Update Status Task
  const handleUpdateStatus = async (itemId: string, status: string, name?: string) => {
    setLoadingItemId(itemId);
    try {
      const res = await fetch("/api/share/empty-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          status,
          workerName: name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah status tugas");
      } else {
        toast.success(
          status === "PROSES"
            ? "Tugas berhasil Anda ambil!"
            : status === "SELESAI"
            ? "Tugas ditandai selesai!"
            : "Tugas dibatalkan."
        );
        fetchItems(false);
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi internet.");
    } finally {
      setLoadingItemId(null);
    }
  };

  // Buka Dialog Nama ketika "Ambil Tugas" diklik
  const triggerTakeTask = (itemId: string) => {
    setActionItemId(itemId);
    setWorkerName("");
    setIsNameDialogOpen(true);
  };

  const submitTakeTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      toast.error("Silakan masukkan nama Anda");
      return;
    }
    if (actionItemId) {
      handleUpdateStatus(actionItemId, "PROSES", workerName.trim());
      setIsNameDialogOpen(false);
      setActionItemId(null);
    }
  };

  // Membagi item berdasarkan tab
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.itemName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesTab =
        activeTab === "AKTIF"
          ? item.status === "BUTUH" || item.status === "PROSES"
          : item.status === "SELESAI";

      return matchesSearch && matchesTab;
    });
  }, [items, searchQuery, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 pb-16 font-sans">
      <div className="mx-auto max-w-xl space-y-6">
        
        {/* Header Toko */}
        <div className="text-center space-y-2 pt-6">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/10 mb-1">
            <ClipboardList className="h-5.5 w-5.5" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-foreground">
            Ceklist Barang Kosong
          </h1>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/15 font-bold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full border border-primary/20">
            📌 Toko: {storeName}
          </Badge>
          <p className="text-[10px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Halaman ini dapat diakses oleh siapa saja untuk melihat daftar belanjaan toko yang kosong dan membantu pengerjaan belanja.
          </p>
        </div>

        {/* Tab & Search */}
        <div className="space-y-3">
          <div className="flex gap-1.5 p-1 bg-white dark:bg-card border border-border/80 rounded-xl shadow-sm">
            <Button
              variant={activeTab === "AKTIF" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("AKTIF")}
              className="flex-1 h-9 text-xs font-bold rounded-lg"
            >
              Aktif / Dibutuhkan
            </Button>
            <Button
              variant={activeTab === "SELESAI" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("SELESAI")}
              className="flex-1 h-9 text-xs font-bold rounded-lg"
            >
              Selesai Belanja
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari barang kosong..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-white dark:bg-card border-border shadow-sm text-sm"
            />
          </div>
        </div>

        {/* List content */}
        <div className="space-y-3">
          {isLoadingList && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-semibold">Memuat daftar barang...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-card rounded-2xl border border-dashed border-border shadow-sm flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <AlertCircle className="h-7 w-7 text-muted-foreground/60" />
              <p className="text-xs font-bold">
                {searchQuery ? "Barang tidak ditemukan" : "Tidak ada ceklist barang"}
              </p>
              <p className="text-[10px] max-w-xs">
                {searchQuery
                  ? "Coba cari nama barang belanjaan yang lain."
                  : activeTab === "AKTIF"
                  ? "Hebat! Semua stok barang aman dan tidak ada barang kosong terdaftar."
                  : "Belum ada barang belanjaan yang ditandai selesai hari ini."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredItems.map((item) => {
                const cleanNotes = getCleanNotes(item.notes);
                const processorName = getProcessorName(item);
                const isStatusProses = item.status === "PROSES";
                const isStatusSelesai = item.status === "SELESAI";
                const isLoading = loadingItemId === item.id;

                return (
                  <Card
                    key={item.id}
                    className={`overflow-hidden border-0 shadow-sm transition-all duration-200 ${
                      isStatusSelesai
                        ? "border-l-4 border-l-emerald-500 bg-emerald-500/[0.01] border border-emerald-500/10"
                        : isStatusProses
                        ? "border-l-4 border-l-amber-500 bg-amber-500/[0.02] border border-amber-500/10"
                        : "border-l-4 border-l-rose-500 bg-white dark:bg-card border border-border"
                    }`}
                  >
                    <CardContent className="p-4 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-sm font-black tracking-tight leading-tight ${isStatusSelesai ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {item.itemName}
                          </h3>
                          <div>
                            {isStatusSelesai ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] py-0 h-4.5 font-bold">
                                Selesai
                              </Badge>
                            ) : isStatusProses ? (
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] py-0 h-4.5 font-bold animate-pulse-slow">
                                Proses Belanja
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] py-0 h-4.5 font-bold">
                                Butuh Dibeli
                              </Badge>
                            )}
                          </div>
                        </div>

                        {cleanNotes && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 p-1.5 rounded border border-border/40 w-fit">
                            📝 {cleanNotes}
                          </p>
                        )}
                      </div>

                      {/* Processing Info */}
                      {processorName && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/5 px-2 py-1 rounded-lg w-fit border border-amber-500/10">
                          <User className="h-3 w-3" />
                          <span>Diproses oleh: {processorName} (Eksternal)</span>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="pt-1.5 border-t border-dashed border-border/80 flex gap-2">
                        {isStatusSelesai ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                            onClick={() => handleUpdateStatus(item.id, "BUTUH")}
                            className="w-full text-xs font-semibold py-4.5 rounded-xl border-border text-muted-foreground hover:bg-accent gap-1.5"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Tandai Belum Selesai
                          </Button>
                        ) : isStatusProses ? (
                          <>
                            <Button
                              size="sm"
                              disabled={isLoading}
                              onClick={() => handleUpdateStatus(item.id, "SELESAI")}
                              className="flex-1 text-xs font-black py-4.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1"
                            >
                              {isLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Tandai Selesai
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isLoading}
                              onClick={() => handleUpdateStatus(item.id, "BUTUH")}
                              className="text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-3 rounded-xl h-9"
                            >
                              Batalkan
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            disabled={isLoading}
                            onClick={() => triggerTakeTask(item.id)}
                            className="w-full text-xs font-black py-5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground shadow-md gap-1"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                            Ambil Tugas Belanja
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Masukkan Nama Pembuat */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent className="max-w-[320px] sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight">
              Siapa nama Anda?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nama Anda akan dicatat agar admin toko mengetahui siapa yang sedang mengambil tugas berbelanja barang kosong ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitTakeTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="workerName" className="text-xs font-bold">
                Nama Anda <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="workerName"
                placeholder="Contoh: Agus, Rian"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                required
                autoFocus
                className="h-10 rounded-xl bg-muted/30"
              />
            </div>

            <DialogFooter className="pt-1 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsNameDialogOpen(false);
                  setActionItemId(null);
                }}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={!workerName.trim()}
                className="w-full sm:w-auto text-xs font-bold rounded-xl"
              >
                Ambil Tugas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
