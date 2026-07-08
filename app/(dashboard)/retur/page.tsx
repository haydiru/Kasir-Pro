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
        loadData();
      }
    } catch {
      toast.error("Gagal menghapus barang retur");
    } finally {
      setActionLoadingId(null);
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 animate-in fade-in duration-300">
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

      {/* Items list */}
      <div className="space-y-4">
        {isLoading ? (
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
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const isResolved = item.status === "RESOLVED";
              const isReturned = item.status === "RETURNED";
              const isPending = item.status === "PENDING";
              const isLoading = actionLoadingId === item.id;

              return (
                <Card
                  key={item.id}
                  className={`overflow-hidden border-0 shadow-sm transition-all duration-200 ${
                    isResolved
                      ? "border-l-4 border-l-emerald-500 bg-emerald-500/[0.02] border border-emerald-500/10"
                      : isReturned
                      ? "border-l-4 border-l-amber-500 bg-amber-500/[0.02] border border-amber-500/10"
                      : "border-l-4 border-l-rose-500 bg-rose-500/[0.02] border border-rose-500/10"
                  }`}
                >
                  <CardContent className="p-4.5 space-y-4">
                    {/* Header: Status badge & delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
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
                        disabled={isLoading}
                        onClick={() => handleDeleteItem(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg -mt-1 -mr-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Product & Supplier */}
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                        Supplier: {item.supplierName}
                      </p>
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
                          disabled={isLoading}
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
                            disabled={isLoading}
                            onClick={() => handleRevertStatus(item.id, item.status)}
                            className="text-xs font-semibold px-3 py-4.5 rounded-lg border-muted-foreground/20 text-muted-foreground hover:bg-accent"
                          >
                            <Undo className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            disabled={isLoading}
                            onClick={() => handleUpdateStatus(item.id, item.status)}
                            className="flex-1 text-xs font-bold py-4.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1"
                          >
                            {isLoading ? (
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
                          disabled={isLoading}
                          onClick={() => handleUpdateStatus(item.id, item.status)}
                          className="w-full text-xs font-bold py-4.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center justify-center gap-1"
                        >
                          {isLoading ? (
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
        )}
      </div>

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
