"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Trash2,
  Clock,
  User,
  Loader2,
  RefreshCw,
  Search,
  MessageSquare
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface UserCompact {
  name: string;
}

interface EmptyItem {
  id: string;
  itemName: string;
  status: string; // 'BUTUH' | 'PROSES' | 'SELESAI'
  notes: string | null;
  createdById: string;
  processorId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserCompact;
  processor?: UserCompact | null;
}

export default function EmptyItemsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<EmptyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("aktif");

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Action Loading states per Item ID
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchItems = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/empty-items");
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      } else {
        toast.error(data.error || "Gagal memuat data barang");
      }
    } catch (err) {
      console.error("Error fetching items:", err);
      if (!isSilent) {
        toast.error("Terjadi kesalahan koneksi internet.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Poll for data every 5 seconds to keep synced
  useEffect(() => {
    fetchItems(false);

    const interval = setInterval(() => {
      fetchItems(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchItems]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      toast.error("Nama barang tidak boleh kosong");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/empty-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: newItemName,
          notes: newItemNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Barang berhasil dilaporkan");
        setNewItemName("");
        setNewItemNotes("");
        setIsDialogOpen(false);
        fetchItems(true); // reload list
      } else {
        toast.error(data.error || "Gagal menyimpan data");
      }
    } catch (err) {
      toast.error("Gagal mengirim data ke server");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/empty-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = "";
        if (newStatus === "PROSES") msg = "Tugas diambil. Segera proses barang ini.";
        else if (newStatus === "SELESAI") msg = "Tugas selesai. Terima kasih!";
        else if (newStatus === "BUTUH") msg = "Status dikembalikan ke butuh.";

        toast.success(msg);
        fetchItems(true);
      } else {
        toast.error(data.error || "Gagal memperbarui status");
      }
    } catch (err) {
      toast.error("Gagal menghubungi server");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus barang kosong ini dari daftar?")) return;

    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/empty-items/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Barang dihapus dari daftar");
        fetchItems(true);
      } else {
        toast.error(data.error || "Gagal menghapus barang");
      }
    } catch (err) {
      toast.error("Gagal menghubungi server");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Filter items based on active tab and search query
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.itemName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const isTabActive = activeTab === "aktif";
    if (isTabActive) {
      return matchesSearch && (item.status === "BUTUH" || item.status === "PROSES");
    } else {
      return matchesSearch && item.status === "SELESAI";
    }
  });

  // Count active items
  const activeCount = items.filter(
    (item) => item.status === "BUTUH" || item.status === "PROSES"
  ).length;

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Ceklist Barang Kosong
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sinkronisasi otomatis (setiap 5s)
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchItems(false)}
          disabled={isRefreshing}
          className="h-9 w-9 rounded-xl p-0"
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${
              isRefreshing ? "animate-spin text-primary" : ""
            }`}
          />
        </Button>
      </div>

      {/* Action Button: Create New Item (Large & Mobile Friendly) */}
      <Button
        size="lg"
        onClick={() => setIsDialogOpen(true)}
        className="w-full text-base font-bold py-6.5 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform"
      >
        <Plus className="h-5 w-5" />
        Laporkan Barang Kosong
      </Button>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder="Cari nama barang..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card border-muted-foreground/10 text-sm"
        />
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue="aktif" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 rounded-xl h-11">
          <TabsTrigger value="aktif" className="rounded-lg text-xs font-bold gap-1.5 py-2">
            Aktif
            {activeCount > 0 && (
              <Badge variant="destructive" className="h-4.5 px-1.5 min-w-4 text-[9px] flex items-center justify-center rounded-full">
                {activeCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="selesai" className="rounded-lg text-xs font-bold py-2">
            Selesai
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-xs">Memuat data barang...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4 bg-muted/20 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-bold">
                {searchQuery ? "Barang tidak ditemukan" : "Semua aman! Tidak ada barang kosong."}
              </p>
              <p className="text-xs max-w-xs">
                {searchQuery
                  ? "Coba cari dengan kata kunci lain."
                  : "Ketuk tombol di atas jika Anda menemukan barang kosong di rak."}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isButuh = item.status === "BUTUH";
              const isProses = item.status === "PROSES";
              const isSelesai = item.status === "SELESAI";
              const isLoadingItem = actionLoading[item.id];

              return (
                <Card
                  key={item.id}
                  className={`overflow-hidden border-0 shadow-sm transition-all duration-200 ${
                    isButuh
                      ? "border-l-4 border-l-rose-500 bg-rose-500/[0.03] dark:bg-rose-950/[0.05] border border-rose-500/10"
                      : isProses
                      ? "border-l-4 border-l-amber-500 bg-amber-500/[0.03] dark:bg-amber-950/[0.05] border border-amber-500/10"
                      : "border-l-4 border-l-emerald-500 bg-emerald-500/[0.03] dark:bg-emerald-950/[0.05] border border-emerald-500/10"
                  }`}
                >
                  <CardContent className="p-4.5 space-y-3">
                    {/* Status & Delete Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        {isButuh && (
                          <Badge variant="destructive" className="text-[10px] py-0 h-5 font-bold uppercase">
                            Butuh
                          </Badge>
                        )}
                        {isProses && (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] py-0 h-5 font-bold uppercase">
                            Proses
                          </Badge>
                        )}
                        {isSelesai && (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] py-0 h-5 font-bold uppercase">
                            Selesai
                          </Badge>
                        )}
                      </div>

                      {/* Delete action only for Selesai or Admin/Creator */}
                      {(isSelesai || session?.user?.id === item.createdById || session?.user?.role === "admin" || session?.user?.role === "super_admin") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isLoadingItem}
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg -mt-1 -mr-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="space-y-1">
                      <h3 className="text-base font-black tracking-tight leading-tight">
                        {item.itemName}
                      </h3>
                      {item.notes && (
                        <div className="bg-background/80 dark:bg-background/30 rounded-lg p-2.5 mt-1.5 border border-border/40 text-xs text-muted-foreground flex items-start gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                          <span className="italic">{item.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Section */}
                    <div className="pt-1.5 border-t border-dashed border-border/60 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground font-medium">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span>Dilapor: {item.createdBy.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span>Waktu: {formatDateTime(item.createdAt)}</span>
                      </div>
                      {isProses && item.processor && (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 mt-0.5 bg-amber-500/10 px-2 py-0.5 rounded w-max">
                          <User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Diproses: {item.processor.name}</span>
                        </div>
                      )}
                      {isSelesai && item.processor && (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mt-0.5 bg-emerald-500/10 px-2 py-0.5 rounded w-max">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Selesai: {item.processor.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button: (Mobile Friendly - Large Click Targets) */}
                    <div className="pt-2">
                      {isButuh && (
                        <Button
                          size="lg"
                          disabled={isLoadingItem}
                          onClick={() => handleStatusUpdate(item.id, "PROSES")}
                          className="w-full text-sm font-black py-5.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md flex items-center justify-center gap-1.5"
                        >
                          {isLoadingItem ? (
                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                          ) : (
                            <Play className="h-4.5 w-4.5" />
                          )}
                          Ambil Tugas
                        </Button>
                      )}

                      {isProses && (
                        <div className="space-y-2">
                          <Button
                            size="lg"
                            disabled={isLoadingItem}
                            onClick={() => handleStatusUpdate(item.id, "SELESAI")}
                            className="w-full text-sm font-black py-5.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5"
                          >
                            {isLoadingItem ? (
                              <Loader2 className="h-4.5 w-4.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4.5 w-4.5" />
                            )}
                            Tandai Selesai
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isLoadingItem}
                            onClick={() => handleStatusUpdate(item.id, "BUTUH")}
                            className="w-full text-xs font-semibold py-4.5 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                          >
                            Batal Ambil Tugas
                          </Button>
                        </div>
                      )}

                      {isSelesai && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoadingItem}
                          onClick={() => handleStatusUpdate(item.id, "BUTUH")}
                          className="w-full text-xs font-bold py-4.5 rounded-lg border-muted-foreground/20 text-muted-foreground hover:bg-accent flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Laporkan Lagi
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </Tabs>

      {/* Dialog for Adding New Item */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Lapor Barang Kosong
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan nama barang yang habis atau kosong di rak display/gudang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="itemName" className="text-xs font-bold">
                Nama Barang <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="itemName"
                placeholder="Contoh: Aqua Botol 600ml"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-bold">
                Catatan Tambahan (Opsional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Contoh: Habis total atau kosong di rak tapi ada di gudang"
                value={newItemNotes}
                onChange={(e) => setNewItemNotes(e.target.value)}
                className="min-h-20 rounded-xl bg-muted/30 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !newItemName.trim()}
                className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                Kirim Laporan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
