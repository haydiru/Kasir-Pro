"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Loader2, Save, Sparkles } from "lucide-react";
import { createProduct, updateProduct } from "@/app/actions/product";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  product?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductFormDialog({ open, product, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [stock, setStock] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [unit, setUnit] = useState("PCS");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setBarcode(product.barcode || "");
      setItemCode(product.itemCode || "");
      setStock(product.stock || 0);
      setCostPrice(product.costPrice || 0);
      setSellingPrice(product.sellingPrice || 0);
      setUnit(product.unit || "PCS");
      setCategory(product.category || "");
    } else {
      setName("");
      setBarcode("");
      setItemCode("");
      setStock(0);
      setCostPrice(0);
      setSellingPrice(0);
      setUnit("PCS");
      setCategory("");
    }
  }, [product, open]);

  // Live margin preview
  const marginNominal = sellingPrice - costPrice;
  const marginPct = sellingPrice > 0 ? (marginNominal / sellingPrice) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama barang wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (product) {
        const res = await updateProduct(product.id, {
          name,
          barcode: barcode || undefined,
          itemCode: itemCode || undefined,
          stock,
          costPrice,
          sellingPrice,
          unit,
          category: category || undefined,
        });
        if (res.success) {
          toast.success("Barang berhasil diperbarui!");
          onSuccess();
          onClose();
        } else {
          toast.error(res.error || "Gagal memperbarui barang");
        }
      } else {
        const res = await createProduct({
          name,
          barcode: barcode || undefined,
          itemCode: itemCode || undefined,
          stock,
          costPrice,
          sellingPrice,
          unit,
          category: category || undefined,
        });
        if (res.success) {
          toast.success("Barang baru berhasil ditambahkan!");
          onSuccess();
          onClose();
        } else {
          toast.error(res.error || "Gagal menambahkan barang");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-6">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <span>{product ? "Edit Data Barang" : "Tambah Barang Baru"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {product
              ? "Perbarui rincian barang dan harga jual/modal toko Anda."
              : "Masukkan data barang baru ke katalog toko Anda."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nama Barang <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Indomie Goreng Spesial 85g"
              required
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Kode Barcode
              </Label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan barcode..."
                className="h-10 text-xs rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                ID / Kode Barang (SKU)
              </Label>
              <Input
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="Contoh: BRG-001"
                className="h-10 text-xs rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Harga Modal (Rp) <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={costPrice || ""}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
                required
                className="h-10 text-xs rounded-xl font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Harga Jual (Rp) <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={sellingPrice || ""}
                onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
                required
                className="h-10 text-xs rounded-xl font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          {/* Margin Live Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Estimasi Margin Laba:</span>
            <span
              className={`font-black ${
                marginPct >= 15
                  ? "text-emerald-600 dark:text-emerald-400"
                  : marginPct >= 5
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {formatCurrency(marginNominal)} ({marginPct.toFixed(1)}%)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Jumlah Stok
              </Label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="h-10 text-xs rounded-xl font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Satuan
              </Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="PCS, DUS, PACK"
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {product ? "Simpan Perubahan" : "Tambah Barang"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
