"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Loader2,
  Search,
  Undo,
  ArrowRight,
  Package,
} from "lucide-react";
import { formatCurrency, formatFullLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  createReturnedItem,
  updateReturnedItemStatus,
  deleteReturnedItem,
  getReturnedItems,
  bulkUpdateReturnedItemStatus,
  bulkDeleteReturnedItems,
} from "@/app/actions/retur";
import SupplierCombobox from "@/components/supplier-combobox";

interface ReturnedItem {
  id: string;
  supplierName: string;
  supplierId: string | null;
  productName: string;
  quantity: number;
  reason: string | null;
  status: string; // 'PENDING' | 'RETURNED' | 'RESOLVED'
  createdById: string | null;
  createdAt: string | Date;
  createdBy?: { name: string } | null;
}

export default function ReturPage() {
  const [items, setItems] = useState<ReturnedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"SEMUA" | "PENDING" | "RETURNED" | "RESOLVED">("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Individual loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load items
  async function loadData() {
    setIsLoading(true);
    try {
      const res = await getReturnedItems();
      if (res.success && res.data) {
        setItems(res.data as any);
      } else {
        toast.error(res.error || "Gagal memuat barang retur");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Form Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error("Nama supplier harus diisi");
      return;
    }
    if (!productName.trim()) {
      toast.error("Nama produk harus diisi");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error("Jumlah barang harus lebih besar dari 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createReturnedItem({
        supplierName,
        supplierId: supplierId || undefined,
        productName,
        quantity: Number(quantity),
        reason: reason || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Barang retur berhasil disimpan!");
        setSupplierName("");
        setSupplierId("");
        setProductName("");
        setQuantity("1");
        setReason("");
        setIsDialogOpen(false);
        loadData();
      }
    } catch {
      toast.error("Terjadi kesalahan teknis.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Update Status Handler
  async function handleUpdateStatus(id: string, currentStatus: string) {
    let newStatus = "PENDING";
    if (currentStatus === "PENDING") {
      newStatus = "RETURNED";
    } else if (currentStatus === "RETURNED") {
      newStatus = "RESOLVED";
    }
    
    setActionLoadingId(id);
    try {
      const res = await updateReturnedItemStatus(id, newStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Status barang retur diperbarui");
        loadData();
      }
    } catch {
      toast.error("Gagal memperbarui status");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Revert/Reset Status Handler
  async function handleRevertStatus(id: string, currentStatus: string) {
    let newStatus = "PENDING";
    if (currentStatus === "RESOLVED") {
      newStatus = "RETURNED";
    }
    
    setActionLoadingId(id);
    try {
      const res = await updateReturnedItemStatus(id, newStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Status barang retur dikembalikan");
        loadData();
      }
    } catch {
      toast.error("Gagal memperbarui status");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Delete Handler
  async function handleDeleteItem(id: string) {
    if (!confirm("Hapus catatan barang retur ini secara permanen?")) return;
    
    setActionLoadingId(id);
    try {
      const res = await deleteReturnedItem(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Barang retur berhasil dihapus");
        setSelectedIds((prev) => prev.filter((item) => item !== id));
        loadData();
      }
    } catch {
      toast.error("Gagal menghapus barang retur");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Multi-select helpers
  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectSupplier = (supplierName: string, groupItems: ReturnedItem[]) => {
    const itemIds = groupItems.map((item) => item.id);
    const allSelected = itemIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !itemIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const newSelection = [...prev];
        itemIds.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  // Bulk Actions
  async function handleBulkUpdateStatus(newStatus: string) {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    try {
      const res = await bulkUpdateReturnedItemStatus(selectedIds, newStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Status berhasil diperbarui secara massal");
        setSelectedIds([]);
        loadData();
      }
    } catch {
      toast.error("Gagal memproses batch update");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Hapus permanen ${selectedIds.length} barang retur terpilih?`)) return;
    setIsLoading(true);
    try {
      const res = await bulkDeleteReturnedItems(selectedIds);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Barang retur berhasil dihapus secara massal");
        setSelectedIds([]);
        loadData();
      }
    } catch {
      toast.error("Gagal menghapus data secara massal");
    } finally {
      setIsLoading(false);
    }
  }

  // Batch action for a single supplier group
  async function handleSupplierBatchAction(groupItems: ReturnedItem[], action: "RETURNED" | "RESOLVED" | "DELETE") {
    const ids = groupItems.map((item) => item.id);
    if (ids.length === 0) return;

    if (action === "DELETE") {
      if (!confirm(`Hapus permanen semua retur (${ids.length}) dari supplier ini?`)) return;
      setIsLoading(true);
      try {
        const res = await bulkDeleteReturnedItems(ids);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(res.success);
          setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
          loadData();
        }
      } catch {
        toast.error("Gagal menghapus data");
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      try {
        const res = await bulkUpdateReturnedItemStatus(ids, action);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(res.success);
          loadData();
        }
      } catch {
        toast.error("Gagal memperbarui status");
      } finally {
        setIsLoading(false);
      }
    }
  }

  // Filter items based on search and status
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "SEMUA" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, statusFilter]);

  // Group items by supplierName
  const groupedItems = useMemo(() => {
    const groups: { [supplierName: string]: ReturnedItem[] } = {};
    filteredItems.forEach((item) => {
      const key = item.supplierName.trim();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Pencatatan Barang Retur
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola barang cacat/rusak/expired untuk dikembalikan ke supplier sebelum pelunasan tagihan.
          </p>
        </div>

        <Button
          onClick={() => setIsDialogOpen(true)}
          className="rounded-xl font-bold gap-2 py-5.5 px-5 shadow-lg shadow-primary/10"
        >
          <Plus className="h-4.5 w-4.5" />
          Catat Retur Baru
        </Button>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari supplier atau barang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-card border-muted-foreground/10 text-sm"
          />
        </div>

        <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl w-fit self-end sm:self-auto">
          <Button
            variant={statusFilter === "PENDING" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("PENDING")}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === "RETURNED" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("RETURNED")}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Dikirim
          </Button>
          <Button
            variant={statusFilter === "RESOLVED" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("RESOLVED")}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Selesai
          </Button>
          <Button
            variant={statusFilter === "SEMUA" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("SEMUA")}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Semua
          </Button>
        </div>
      </div>

      {/* Items list grouped by supplier */}
      <div className="space-y-6">
        {isLoading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Memuat data barang retur...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/20 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-bold">
              {searchQuery ? "Data tidak ditemukan" : "Tidak ada catatan barang retur"}
            </p>
            <p className="text-xs max-w-xs">
              {searchQuery
                ? "Cobalah mencari kata kunci lain."
                : "Semua retur telah selesai diproses! Gunakan tombol di atas untuk mencatat barang retur baru."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([supplierName, groupItems]) => {
              const supplierItemIds = groupItems.map((i) => i.id);
              const allSelected = supplierItemIds.every((id) => selectedIds.includes(id));
              const someSelected = supplierItemIds.some((id) => selectedIds.includes(id)) && !allSelected;

              // Filter actions based on what's available
              const hasPending = groupItems.some((i) => i.status === "PENDING");
              const hasReturned = groupItems.some((i) => i.status === "RETURNED");

              return (
                <div key={supplierName} className="space-y-3 animate-in fade-in duration-200">
                  {/* Supplier Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 dark:bg-muted/10 p-3 rounded-xl border border-border/80">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="h-4.5 w-4.5 rounded border-muted-foreground/30 text-primary focus:ring-primary accent-primary cursor-pointer"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = someSelected;
                          }
                        }}
                        onChange={() => handleToggleSelectSupplier(supplierName, groupItems)}
                      />
                      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5">
                        {supplierName}
                        <Badge variant="secondary" className="text-[10px] font-bold py-0 px-1.5 h-4.5 bg-muted-foreground/10 text-muted-foreground">
                          {groupItems.length}
                        </Badge>
                      </h2>
                    </div>

                    {/* Per-Company Bulk Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {hasPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSupplierBatchAction(groupItems, "RETURNED")}
                          className="h-7 text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2 rounded-lg"
                        >
                          Kirim Semua
                        </Button>
                      )}
                      {hasReturned && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSupplierBatchAction(groupItems, "RESOLVED")}
                          className="h-7 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 px-2 rounded-lg"
                        >
                          Selesaikan Semua
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSupplierBatchAction(groupItems, "DELETE")}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Supplier Cards Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {groupItems.map((item) => {
                      const isResolved = item.status === "RESOLVED";
                      const isReturned = item.status === "RETURNED";
                      const isPending = item.status === "PENDING";
                      const isItemLoading = actionLoadingId === item.id;
                      const isSelected = selectedIds.includes(item.id);

                      return (
                        <Card
                          key={item.id}
                          className={`overflow-hidden border-0 shadow-sm transition-all duration-200 relative ${
                            isSelected ? "ring-2 ring-primary/60 bg-primary/[0.01]" : ""
                          } ${
                            isResolved
                              ? "border-l-4 border-l-emerald-500 bg-emerald-500/[0.02] border border-emerald-500/10"
                              : isReturned
                              ? "border-l-4 border-l-amber-500 bg-amber-500/[0.02] border border-amber-500/10"
                              : "border-l-4 border-l-rose-500 bg-rose-500/[0.02] border border-rose-500/10"
                          }`}
                        >
                          <CardContent className="p-4.5 space-y-4">
                            {/* Header: Checkbox & Status */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary accent-primary cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectItem(item.id)}
                                />
                                {isResolved ? (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[9px] py-0 h-4 font-bold uppercase text-white">
                                    Selesai / Clear
                                  </Badge>
                                ) : isReturned ? (
                                  <Badge className="bg-amber-600 hover:bg-amber-700 text-[9px] py-0 h-4 font-bold uppercase text-white">
                                    Telah Dikirim
                                  </Badge>
                                ) : (
                                  <Badge className="bg-rose-600 hover:bg-rose-700 text-[9px] py-0 h-4 font-bold uppercase text-white">
                                    Pending / Di Toko
                                  </Badge>
                                )}
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isItemLoading}
                                onClick={() => handleDeleteItem(item.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg -mt-1 -mr-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Product Info */}
                            <div className="space-y-1">
                              <h3 className="text-base font-black tracking-tight leading-tight text-foreground flex justify-between">
                                <span>{item.productName}</span>
                                <span className="text-primary font-mono">x{item.quantity}</span>
                              </h3>
                              {item.reason && (
                                <p className="text-xs text-muted-foreground mt-1 bg-muted/40 p-2 rounded">
                                  Alasan: {item.reason}
                                </p>
                              )}
                            </div>

                            {/* Metadata */}
                            <div className="pt-2 border-t border-dashed border-border/60 space-y-1 text-[11px] text-muted-foreground font-semibold">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                                <span>Dicatat: {formatFullLocalDate(item.createdAt, "Asia/Jakarta")}</span>
                              </div>
                              {item.createdBy && (
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-muted-foreground/75" />
                                  <span>Oleh: {item.createdBy.name}</span>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="pt-1 flex gap-2">
                              {isResolved ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isItemLoading}
                                  onClick={() => handleRevertStatus(item.id, item.status)}
                                  className="w-full text-xs font-semibold py-4.5 rounded-lg border-muted-foreground/20 text-muted-foreground hover:bg-accent flex items-center justify-center gap-1.5"
                                >
                                  <Undo className="h-3.5 w-3.5" />
                                  Kembalikan ke Dikirim
                                </Button>
                              ) : isReturned ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isItemLoading}
                                    onClick={() => handleRevertStatus(item.id, item.status)}
                                    className="text-xs font-semibold px-3 py-4.5 rounded-lg border-muted-foreground/20 text-muted-foreground hover:bg-accent"
                                  >
                                    <Undo className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={isItemLoading}
                                    onClick={() => handleUpdateStatus(item.id, item.status)}
                                    className="flex-1 text-xs font-bold py-4.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1"
                                  >
                                    {isItemLoading ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    Selesai (Clear)
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={isItemLoading}
                                  onClick={() => handleUpdateStatus(item.id, item.status)}
                                  className="w-full text-xs font-bold py-4.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center justify-center gap-1"
                                >
                                  {isItemLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  )}
                                  Tandai Dikirim Ke Supplier
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border/80 shadow-2xl rounded-2xl py-3.5 px-5 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-xs font-black text-foreground">
            {selectedIds.length} Barang Terpilih
          </span>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkUpdateStatus("RETURNED")}
              className="h-8 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1"
            >
              <ArrowRight className="h-3 w-3" />
              Kirim ke Supplier
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkUpdateStatus("RESOLVED")}
              className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              Tandai Selesai
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              className="h-8 text-[11px] font-bold rounded-lg gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Hapus
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Catat Retur Baru */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Catat Barang Retur
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan informasi barang rusak atau kedaluwarsa yang akan dikembalikan ke supplier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Supplier Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Nama Supplier <span className="text-rose-500">*</span>
              </Label>
              <SupplierCombobox
                selectedId={supplierId}
                selectedName={supplierName}
                onChange={(id, name) => {
                  setSupplierId(id);
                  setSupplierName(name);
                }}
              />
            </div>

            {/* Nama Produk */}
            <div className="space-y-1.5">
              <Label htmlFor="productName" className="text-xs font-bold">
                Nama Barang / Produk <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="productName"
                placeholder="Contoh: Susu UHT Cokelat 200ml"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/30"
              />
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-bold">
                Jumlah (Pcs / Karton) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/30 font-mono"
              />
            </div>

            {/* Alasan */}
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs font-bold">
                Alasan Retur / Keterangan
              </Label>
              <Input
                id="reason"
                placeholder="Contoh: Bocor / Expired 2 Bulan Lagi"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 rounded-xl bg-muted/30"
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
                disabled={isSubmitting || !supplierName.trim() || !productName.trim() || !quantity}
                className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Barang Retur
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
