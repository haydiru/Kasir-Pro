"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
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
  Search,
  Loader2,
  Check,
  User,
  Play,
  RotateCcw,
  X,
  CheckSquare,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";

interface EmptyItem {
  id: string;
  itemName: string;
  status: string;
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

const STORAGE_KEY = "kasirpro_share_worker_name";

export default function ShareClient({ storeId, storeName, timezone }: Props) {
  const [items, setItems] = useState<EmptyItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"AKTIF" | "SELESAI">("AKTIF");
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Worker identity (persisted in localStorage)
  const [workerName, setWorkerName] = useState("");
  const [isNameSet, setIsNameSet] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Loading states
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Load saved name from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      setWorkerName(saved);
      setIsNameSet(true);
    } else {
      setShowWelcome(true);
    }
  }, []);

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

  // Polling setiap 5 detik
  useEffect(() => {
    fetchItems(true);
    const interval = setInterval(() => fetchItems(false), 5000);
    return () => clearInterval(interval);
  }, [storeId]);

  // Save name handler
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      toast.error("Silakan masukkan nama Anda");
      return;
    }
    const name = nameInput.trim();
    localStorage.setItem(STORAGE_KEY, name);
    setWorkerName(name);
    setIsNameSet(true);
    setShowWelcome(false);
    toast.success(`Selamat datang, ${name}! 👋`);
  };

  // Change name
  const handleChangeName = () => {
    setNameInput(workerName);
    setShowWelcome(true);
  };

  // Helper: Ekstrak nama pemroses dari catatan
  const getProcessorName = (item: EmptyItem) => {
    if (item.processor) return item.processor.name;
    if (item.notes && item.notes.startsWith("[Diproses oleh: ")) {
      const match = item.notes.match(/^\[Diproses oleh: (.*?)\]/);
      if (match) return match[1];
    }
    return null;
  };

  // Helper: Catatan tanpa prefix pemroses
  const getCleanNotes = (notes: string | null) => {
    if (!notes) return "";
    return notes.replace(/^\[Diproses oleh: (.*?)\]\s*/, "");
  };

  // --- Single item status update ---
  const handleUpdateStatus = async (itemId: string, status: string) => {
    setLoadingItemId(itemId);
    try {
      const res = await fetch("/api/share/empty-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status, workerName }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah status");
      } else {
        toast.success(
          status === "PROSES" ? "Tugas berhasil diambil!" :
          status === "SELESAI" ? "Tugas ditandai selesai!" :
          "Status dikembalikan."
        );
        setSelectedIds((prev) => prev.filter((id) => id !== itemId));
        fetchItems(false);
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setLoadingItemId(null);
    }
  };

  // --- Bulk status update ---
  const handleBulkUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;
    setIsBulkLoading(true);
    try {
      // Execute all updates in parallel
      const results = await Promise.allSettled(
        selectedIds.map((itemId) =>
          fetch("/api/share/empty-items", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, status, workerName }),
          })
        )
      );

      const successCount = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;

      if (successCount > 0) {
        toast.success(
          status === "PROSES" ? `${successCount} tugas berhasil diambil!` :
          status === "SELESAI" ? `${successCount} tugas ditandai selesai!` :
          `${successCount} tugas dikembalikan.`
        );
        setSelectedIds([]);
        fetchItems(false);
      } else {
        toast.error("Gagal memproses batch.");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  // --- Selection helpers ---
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "AKTIF"
        ? item.status === "BUTUH" || item.status === "PROSES"
        : item.status === "SELESAI";
      return matchesSearch && matchesTab;
    });
  }, [items, searchQuery, activeTab]);

  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => selectedIds.includes(item.id));
  }, [filteredItems, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const filteredItemIds = filteredItems.map((item) => item.id);
      setSelectedIds((prev) => prev.filter((id) => !filteredItemIds.includes(id)));
    } else {
      const newSelections = [...selectedIds];
      filteredItems.forEach((item) => {
        if (!newSelections.includes(item.id)) newSelections.push(item.id);
      });
      setSelectedIds(newSelections);
    }
  };

  // Determine bulk action relevance
  const selectionSummary = useMemo(() => {
    if (selectedIds.length === 0) return { hasButuh: false, hasProses: false, hasSelesai: false };
    const selected = items.filter((item) => selectedIds.includes(item.id));
    return {
      hasButuh: selected.some((item) => item.status === "BUTUH"),
      hasProses: selected.some((item) => item.status === "PROSES"),
      hasSelesai: selected.some((item) => item.status === "SELESAI"),
    };
  }, [selectedIds, items]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 pb-32 font-sans">
      <div className="mx-auto max-w-xl space-y-5">

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

          {/* Worker Identity Badge */}
          {isNameSet && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <Badge
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-[10px] px-3 py-1 rounded-full gap-1.5 cursor-pointer hover:bg-emerald-500/20 transition"
                onClick={handleChangeName}
              >
                <User className="h-3 w-3" />
                Masuk sebagai: {workerName}
              </Badge>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Halaman ini dapat diakses oleh siapa saja. Anda bisa mengambil tugas belanja dan menandai barang selesai dibeli.
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

          {/* Select All */}
          {isNameSet && filteredItems.length > 0 && (
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
                  ? "Coba cari nama barang yang lain."
                  : activeTab === "AKTIF"
                  ? "Semua stok aman, tidak ada barang kosong."
                  : "Belum ada barang yang selesai dibeli."}
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
                const isSelected = selectedIds.includes(item.id);

                return (
                  <Card
                    key={item.id}
                    className={`overflow-hidden border-0 shadow-sm transition-all duration-200 ${
                      isStatusSelesai
                        ? "border-l-4 border-l-emerald-500 bg-emerald-500/[0.01] border border-emerald-500/10"
                        : isStatusProses
                        ? "border-l-4 border-l-amber-500 bg-amber-500/[0.02] border border-amber-500/10"
                        : "border-l-4 border-l-rose-500 bg-white dark:bg-card border border-border"
                    } ${isSelected ? "ring-2 ring-primary/60" : ""}`}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      {/* Checkbox */}
                      {isNameSet && (
                        <div className="pt-1.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="h-5 w-5 rounded border-muted-foreground/30 text-primary focus:ring-primary cursor-pointer"
                          />
                        </div>
                      )}

                      <div className="flex-1 space-y-3 min-w-0">
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

                        {/* Processor info */}
                        {processorName && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/5 px-2 py-1 rounded-lg w-fit border border-amber-500/10">
                            <User className="h-3 w-3" />
                            <span>Diproses oleh: {processorName}</span>
                          </div>
                        )}

                        {/* Single Action Buttons (only if no bulk selection active) */}
                        {isNameSet && selectedIds.length === 0 && (
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
                                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  Selesai
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
                                onClick={() => handleUpdateStatus(item.id, "PROSES")}
                                className="w-full text-xs font-black py-5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground shadow-md gap-1"
                              >
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                Ambil Tugas Belanja
                              </Button>
                            )}
                          </div>
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

      {/* Floating Bulk Action Bar */}
      {isNameSet && selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-black tracking-tight flex items-center gap-1.5 text-primary">
              <CheckSquare className="h-4.5 w-4.5 text-primary" />
              {selectedIds.length} Barang Terpilih
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={isBulkLoading}
              onClick={() => setSelectedIds([])}
              className="h-7 w-7 rounded-full text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {activeTab === "AKTIF" ? (
              <>
                {selectionSummary.hasButuh && (
                  <Button
                    size="lg"
                    disabled={isBulkLoading}
                    onClick={() => handleBulkUpdate("PROSES")}
                    className="col-span-2 text-xs font-bold py-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow"
                  >
                    {isBulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                    Ambil {selectedIds.length} Tugas
                  </Button>
                )}

                <Button
                  size="lg"
                  disabled={isBulkLoading}
                  onClick={() => handleBulkUpdate("SELESAI")}
                  className={`${selectionSummary.hasButuh ? "col-span-1" : "col-span-2"} text-xs font-bold py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow`}
                >
                  {isBulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                  Selesai ({selectedIds.length})
                </Button>

                {selectionSummary.hasProses && (
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isBulkLoading}
                    onClick={() => handleBulkUpdate("BUTUH")}
                    className={`${selectionSummary.hasButuh ? "col-span-1" : "col-span-2"} text-xs font-bold py-5 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/20`}
                  >
                    Batal ({selectedIds.length})
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="lg"
                disabled={isBulkLoading}
                onClick={() => handleBulkUpdate("BUTUH")}
                className="col-span-2 text-xs font-bold py-5 rounded-xl"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Tandai Belum Selesai ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Welcome / Input Nama (once only) */}
      <Dialog open={showWelcome} onOpenChange={(open) => { if (isNameSet) setShowWelcome(open); }}>
        <DialogContent className="max-w-[320px] sm:max-w-sm rounded-2xl p-6" onInteractOutside={(e) => { if (!isNameSet) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              {isNameSet ? "Ganti Nama" : "Selamat Datang!"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isNameSet
                ? "Masukkan nama baru Anda untuk memperbarui identitas."
                : "Sebelum memulai, masukkan nama Anda agar admin toko tahu siapa yang mengerjakan belanja. Nama hanya perlu diisi sekali saja."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveName} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="workerNameInput" className="text-xs font-bold">
                Nama Anda <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="workerNameInput"
                placeholder="Contoh: Agus, Rian, Siti"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                autoFocus
                className="h-10 rounded-xl bg-muted/30"
              />
            </div>

            <DialogFooter className="pt-1 flex flex-col sm:flex-row gap-2">
              {isNameSet && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowWelcome(false)}
                  className="w-full sm:w-auto text-xs font-semibold rounded-xl"
                >
                  Batal
                </Button>
              )}
              <Button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full sm:w-auto text-xs font-bold rounded-xl"
              >
                {isNameSet ? "Simpan Nama Baru" : "Mulai Membantu 🚀"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
