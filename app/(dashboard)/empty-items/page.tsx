"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  MessageSquare,
  CheckSquare,
  Square,
  ListPlus,
  FileText,
  X,
  Share2,
  Copy,
  Check
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

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"single" | "batch">("single");
  const [newItemName, setNewItemName] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [batchInputText, setBatchInputText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Action Loading states per Item ID or Bulk
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  // Share Link state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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
    } finaly: {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fix finaly typo if present:
  const fetchItemsSafe = useCallback(async (isSilent = false) => {
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
    fetchItemsSafe(false);

    const interval = setInterval(() => {
      fetchItemsSafe(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchItemsSafe]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      let payload = {};

      if (inputMode === "single") {
        if (!newItemName.trim()) {
          toast.error("Nama barang tidak boleh kosong");
          setIsCreating(false);
          return;
        }
        payload = {
          itemName: newItemName,
          notes: newItemNotes,
        };
      } else {
        const names = batchInputText
          .split(/[\n,]/)
          .map((name) => name.trim())
          .filter((name) => name.length > 0);

        if (names.length === 0) {
          toast.error("Masukkan minimal satu nama barang");
          setIsCreating(false);
          return;
        }

        payload = {
          items: names.map((name) => ({ itemName: name, notes: "" })),
        };
      }

      const res = await fetch("/api/empty-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Barang berhasil dilaporkan");
        setNewItemName("");
        setNewItemNotes("");
        setBatchInputText("");
        setIsDialogOpen(false);
        fetchItemsSafe(true); // reload list
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
        // Deselect if active item is modified
        setSelectedIds((prev) => prev.filter((itemIdx) => itemIdx !== id));
        fetchItemsSafe(true);
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
        setSelectedIds((prev) => prev.filter((itemIdx) => itemIdx !== id));
        fetchItemsSafe(true);
      } else {
        toast.error(data.error || "Gagal menghapus barang");
      }
    } catch (err) {
      toast.error("Gagal menghubungi server");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // --- Bulk Actions ---
  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setIsBulkActionLoading(true);
    try {
      const res = await fetch("/api/empty-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = "";
        if (newStatus === "PROSES") msg = `${selectedIds.length} tugas diambil.`;
        else if (newStatus === "SELESAI") msg = `${selectedIds.length} barang ditandai selesai.`;
        else if (newStatus === "BUTUH") msg = `${selectedIds.length} barang dikembalikan ke butuh.`;

        toast.success(msg);
        setSelectedIds([]);
        fetchItemsSafe(true);
      } else {
        toast.error(data.error || "Gagal memperbarui status barang");
      }
    } catch (err) {
      toast.error("Gagal menghubungi server");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Hapus ${selectedIds.length} barang terpilih secara permanen?`)) return;

    setIsBulkActionLoading(true);
    try {
      const res = await fetch("/api/empty-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`${selectedIds.length} barang berhasil dihapus`);
        setSelectedIds([]);
        fetchItemsSafe(true);
      } else {
        toast.error(data.error || "Gagal menghapus barang");
      }
    } catch (err) {
      toast.error("Gagal menghubungi server");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // --- Helpers for Filtering ---
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
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
  }, [items, searchQuery, activeTab]);

  // Count active items
  const activeCount = useMemo(() => {
    return items.filter(
      (item) => item.status === "BUTUH" || item.status === "PROSES"
    ).length;
  }, [items]);

  // Handle individual checkbox toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  // Check if all filtered items are selected
  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => selectedIds.includes(item.id));
  }, [filteredItems, selectedIds]);

  // Toggle selection for all filtered items
  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all items of this tab
      const filteredItemIds = filteredItems.map((item) => item.id);
      setSelectedIds((prev) => prev.filter((id) => !filteredItemIds.includes(id)));
    } else {
      // Select all items of this tab
      const newSelections = [...selectedIds];
      filteredItems.forEach((item) => {
        if (!newSelections.includes(item.id)) {
          newSelections.push(item.id);
        }
      });
      setSelectedIds(newSelections);
    }
  };

  // Determine what bulk actions are relevant based on selected items
  const selectionSummary = useMemo(() => {
    if (selectedIds.length === 0) return { hasButuh: false, hasProses: false, hasSelesai: false };
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    return {
      hasButuh: selectedItems.some((item) => item.status === "BUTUH"),
      hasProses: selectedItems.some((item) => item.status === "PROSES"),
      hasSelesai: selectedItems.some((item) => item.status === "SELESAI"),
    };
  }, [selectedIds, items]);

  // Reset selected IDs when tab changes
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-28 animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Ceklist Barang Kosong
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sinkronisasi otomatis (setiap 5s)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsShareDialogOpen(true)}
            className="h-9 rounded-xl px-3 gap-1.5 text-xs font-bold"
          >
            <Share2 className="h-3.5 w-3.5" />
            Bagikan
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchItemsSafe(false)}
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
      </div>

      {/* Action Button: Create New Item (Large & Mobile Friendly) */}
      <Button
        size="lg"
        onClick={() => {
          setInputMode("single");
          setIsDialogOpen(true);
        }}
        className="w-full text-base font-bold py-6.5 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform"
      >
        <Plus className="h-5 w-5" />
        Laporkan Barang Kosong
      </Button>

      {/* Search & Bulk Select Header */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <Input
            placeholder="Cari nama barang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-muted-foreground/10 text-sm"
          />
        </div>

        {filteredItems.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="h-5 w-5 rounded border-muted-foreground/30 text-primary focus:ring-primary cursor-pointer"
              />
              Pilih Semua ({filteredItems.length})
            </label>
            
            {selectedIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                Batal Pilih
              </Button>
            )}
          </div>
        )}
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
              const isSelected = selectedIds.includes(item.id);

              return (
                <Card
                  key={item.id}
                  className={`overflow-hidden border-0 shadow-sm transition-all duration-200 ${
                    isButuh
                      ? "border-l-4 border-l-rose-500 bg-rose-500/[0.03] dark:bg-rose-950/[0.05] border border-rose-500/10"
                      : isProses
                      ? "border-l-4 border-l-amber-500 bg-amber-500/[0.03] dark:bg-amber-950/[0.05] border border-amber-500/10"
                      : "border-l-4 border-l-emerald-500 bg-emerald-500/[0.03] dark:bg-emerald-950/[0.05] border border-emerald-500/10"
                  } ${isSelected ? "ring-2 ring-primary/60 bg-primary/[0.02]" : ""}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    {/* Checkbox selection for bulk actions */}
                    <div className="pt-1.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="h-6 w-6 rounded border-muted-foreground/30 text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
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

                        {/* Delete action only for Selesai or Creator/Admin */}
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
                        <h3 className="text-base font-black tracking-tight leading-tight break-words">
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
                      <div className="pt-1">
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
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </Tabs>

      {/* Floating Action Bar for Bulk/Batch Updates (Mobile-friendly fixed design) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4.5 z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-black tracking-tight flex items-center gap-1.5 text-primary">
              <CheckSquare className="h-4.5 w-4.5 text-primary" />
              {selectedIds.length} Barang Terpilih
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={isBulkActionLoading}
              onClick={() => setSelectedIds([])}
              className="h-7 w-7 rounded-full text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {activeTab === "aktif" ? (
              <>
                {selectionSummary.hasButuh && (
                  <Button
                    size="lg"
                    disabled={isBulkActionLoading}
                    onClick={() => handleBulkStatusUpdate("PROSES")}
                    className="col-span-2 text-xs font-bold py-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow"
                  >
                    {isBulkActionLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Ambil {selectedIds.length} Tugas
                  </Button>
                )}
                
                <Button
                  size="lg"
                  disabled={isBulkActionLoading}
                  onClick={() => handleBulkStatusUpdate("SELESAI")}
                  className={`${
                    selectionSummary.hasButuh ? "col-span-1" : "col-span-2"
                  } text-xs font-bold py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow`}
                >
                  {isBulkActionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Selesaikan ({selectedIds.length})
                </Button>

                {selectionSummary.hasProses && (
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isBulkActionLoading}
                    onClick={() => handleBulkStatusUpdate("BUTUH")}
                    className={`${
                      selectionSummary.hasButuh ? "col-span-1" : "col-span-2"
                    } text-xs font-bold py-5 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/20`}
                  >
                    Batal Ambil ({selectedIds.length})
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isBulkActionLoading}
                  onClick={() => handleBulkStatusUpdate("BUTUH")}
                  className="col-span-1 text-xs font-bold py-5 rounded-xl"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Laporkan Lagi
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={isBulkActionLoading}
                  onClick={handleBulkDelete}
                  className="col-span-1 text-xs font-bold py-5 rounded-xl"
                >
                  {isBulkActionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Hapus ({selectedIds.length})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dialog for Adding New Item (Supports single or batch input) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Lapor Barang Kosong
            </DialogTitle>
            <DialogDescription className="text-xs">
              Laporkan satu barang atau masukkan banyak barang kosong sekaligus untuk diisi ulang.
            </DialogDescription>
          </DialogHeader>

          {/* Input Mode Selector Buttons */}
          <div className="grid grid-cols-2 p-1 bg-muted rounded-xl h-10 mt-1">
            <Button
              type="button"
              variant={inputMode === "single" ? "secondary" : "ghost"}
              onClick={() => setInputMode("single")}
              className={`h-8 text-xs font-bold rounded-lg ${
                inputMode === "single" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Satu Barang
            </Button>
            <Button
              type="button"
              variant={inputMode === "batch" ? "secondary" : "ghost"}
              onClick={() => setInputMode("batch")}
              className={`h-8 text-xs font-bold rounded-lg ${
                inputMode === "batch" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <ListPlus className="h-3.5 w-3.5 mr-1.5" />
              Banyak Sekaligus
            </Button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {inputMode === "single" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="itemName" className="text-xs font-bold">
                    Nama Barang <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="itemName"
                    placeholder="Contoh: Aqua Botol 600ml"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required={inputMode === "single"}
                    className="h-10 rounded-xl bg-muted/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-bold">
                    Catatan Tambahan (Opsional)
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Contoh: Kosong di rak pajang saja"
                    value={newItemNotes}
                    onChange={(e) => setNewItemNotes(e.target.value)}
                    className="min-h-20 rounded-xl bg-muted/30 text-xs"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="batchInput" className="text-xs font-bold">
                  Daftar Nama Barang <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="batchInput"
                  placeholder="Contoh:&#10;Aqua Botol 600ml&#10;Mie Instan Goreng&#10;Teh Celup Sariwangi"
                  value={batchInputText}
                  onChange={(e) => setBatchInputText(e.target.value)}
                  required={inputMode === "batch"}
                  className="min-h-32 rounded-xl bg-muted/30 text-xs font-medium"
                />
                <p className="text-[10px] text-muted-foreground font-medium">
                  * Tulis satu barang per baris, atau pisahkan dengan tanda koma.
                </p>
              </div>
            )}

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
                disabled={
                  isCreating ||
                  (inputMode === "single" && !newItemName.trim()) ||
                  (inputMode === "batch" && !batchInputText.trim())
                }
                className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                Kirim Laporan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Share Link */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Bagikan Link Ceklist
            </DialogTitle>
            <DialogDescription className="text-xs">
              Salin link di bawah ini dan kirimkan ke orang yang akan membantu belanja. Mereka <strong>tidak perlu login</strong> dan hanya bisa mengubah status (Proses / Selesai), tidak bisa menambah atau menghapus barang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/empty-items/${session?.user?.storeId || ''}`}
                className="h-10 rounded-xl bg-muted/30 text-xs font-mono flex-1"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/share/empty-items/${session?.user?.storeId || ''}`;
                  navigator.clipboard.writeText(url);
                  setIsCopied(true);
                  toast.success("Link berhasil disalin ke clipboard!");
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="h-10 rounded-xl px-4 gap-1.5 text-xs font-bold shrink-0"
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Tersalin!" : "Salin"}
              </Button>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">⚠️ Catatan Keamanan</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400/80 leading-relaxed">
                Siapapun yang memiliki link ini bisa melihat dan memperbarui status ceklist barang kosong toko Anda. Bagikan hanya kepada orang yang Anda percaya.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
