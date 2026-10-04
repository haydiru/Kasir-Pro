"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HelpCircle,
  Plus,
  Search,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  scanReceiptWithAi,
  manualMapReceiptItem,
  markItemNotInKasir,
  confirmItemAdjusted,
  quickAddProductFromScannedItem,
} from "@/app/actions/receipt-ai";
import { uploadReceipt } from "@/app/actions/upload";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  products: any[];
  onSuccess?: () => void;
}

export default function ReceiptScannerModal({ open, onClose, products, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [activeMappingItemId, setActiveMappingItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleScan = async () => {
    if (!file) {
      toast.error("Pilih foto nota belanja terlebih dahulu");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Upload foto nota ke storage / base64
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await uploadReceipt(formData);

      if (!uploadRes.success || !uploadRes.url) {
        toast.error(uploadRes.error || "Gagal mengunggah foto nota");
        setIsProcessing(false);
        return;
      }

      // 2. Panggil AI Scan via OpenRouter (GPT Luna)
      toast.info("Mengirim gambar ke Vision AI GPT Luna...");
      const scanRes = await scanReceiptWithAi(uploadRes.url, { bypassToggle: true });

      if (scanRes.success && scanRes.data) {
        setScanResult(scanRes.data);
        const hikeCount = scanRes.data.priceHikesDetected || 0;
        toast.success(
          hikeCount > 0
            ? `Ekstraksi selesai! Terdeteksi ${hikeCount} barang mengalami kenaikan harga modal.`
            : "Ekstraksi nota berhasil diselesaikan!"
        );
        if (onSuccess) onSuccess();
      } else {
        toast.error(scanRes.error || "Gagal mengekstrak struk nota");
      }
    } catch {
      toast.error("Terjadi kesalahan saat memproses nota belanja");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMapProduct = async (scannedItemId: string, productId: string) => {
    setActionLoadingId(scannedItemId);
    try {
      const res = await manualMapReceiptItem(scannedItemId, productId);
      if (res.success) {
        toast.success("Barang nota berhasil dihubungkan ke produk toko!");
        setScanResult((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) =>
            it.id === scannedItemId
              ? {
                  ...it,
                  matchedProductId: productId,
                  matchStatus: "CONFIRMED",
                  priceIncreased: res.data?.priceIncreased,
                  oldCostPrice: res.data?.oldCostPrice,
                }
              : it
          ),
        }));
        setActiveMappingItemId(null);
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menghubungkan produk");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkNotInKasir = async (scannedItemId: string) => {
    setActionLoadingId(scannedItemId);
    try {
      const res = await markItemNotInKasir(scannedItemId);
      if (res.success) {
        toast.success("Barang ditandai belum ada di aplikasi kasir");
        setScanResult((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) =>
            it.id === scannedItemId
              ? { ...it, isMarkedNotInKasir: true, matchStatus: "CONFIRMED" }
              : it
          ),
        }));
      } else {
        toast.error(res.error || "Gagal menandai barang");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmAdjusted = async (scannedItemId: string) => {
    setActionLoadingId(scannedItemId);
    try {
      const res = await confirmItemAdjusted(scannedItemId);
      if (res.success) {
        toast.success("Dikonfirmasi: Harga barang sudah disesuaikan di aplikasi kasir!");
        setScanResult((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) =>
            it.id === scannedItemId
              ? { ...it, isAdjustedInKasir: true }
              : it
          ),
        }));
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal mengonfirmasi");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleQuickAdd = async (item: any) => {
    const suggestedSelling = Math.round(item.unitPrice * 1.15); // Default saran margin 15%
    setActionLoadingId(item.id);
    try {
      const res = await quickAddProductFromScannedItem(item.id, suggestedSelling, item.qty);
      if (res.success) {
        toast.success(`Produk "${item.rawName}" berhasil ditambahkan ke Master Barang!`);
        setScanResult((prev: any) => ({
          ...prev,
          items: prev.items.map((it: any) =>
            it.id === item.id
              ? { ...it, matchStatus: "CONFIRMED", matchedProductId: res.data.id }
              : it
          ),
        }));
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menambahkan produk");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.itemCode?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl rounded-2xl p-6 max-h-[88vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span>Scan Foto Nota & Cek Kenaikan Modal (AI)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ekstraksi otomatis foto nota belanja kasir menggunakan model <strong>GPT Luna</strong> untuk mencocokkan harga modal dan mendeteksi kenaikan biaya barang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Uploader jika belum scan */}
          {!scanResult ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border/80 hover:border-purple-500/50 rounded-2xl p-8 text-center bg-purple-500/5 transition-all">
                <input
                  type="file"
                  id="receipt-file-input"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <label
                  htmlFor="receipt-file-input"
                  className="flex flex-col items-center justify-center gap-2.5 cursor-pointer"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {file ? file.name : "Pilih Foto Struk / Nota Pembelian"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Format JPG, PNG, atau WebP (foto nota kasir/distributor)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={isProcessing} className="h-9 rounded-xl text-xs font-bold">
                  Batal
                </Button>
                <Button
                  onClick={handleScan}
                  disabled={!file || isProcessing}
                  className="h-9 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-xs"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mengekstrak Nota (GPT Luna)...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Ekstrak & Analisis Nota Sekarang
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Hasil Scan AI */
            <div className="space-y-4">
              {/* Header Info Nota */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Faktur / Toko: <span className="text-purple-700 dark:text-purple-400">{scanResult.supplierName || "Supplier Umum"}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Total Transaksi: <span className="font-bold text-foreground">{formatCurrency(scanResult.totalAmount)}</span>
                    {scanResult.invoiceDate && ` • Tanggal: ${new Date(scanResult.invoiceDate).toLocaleDateString("id-ID")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={scanResult.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Foto Nota
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setScanResult(null);
                      setFile(null);
                    }}
                    className="h-7 rounded-lg text-xs"
                  >
                    Scan Nota Lain
                  </Button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Daftar Barang yang Terbaca di Nota ({scanResult.items?.length || 0} Item)
                </p>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {scanResult.items?.map((item: any) => {
                    const isMatched = item.matchStatus === "MATCHED" || item.matchStatus === "CONFIRMED";
                    const isHike = item.priceIncreased;
                    const matchedProd = products.find((p) => p.id === item.matchedProductId);
                    const isLoadingThis = actionLoadingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isHike
                            ? "bg-amber-500/5 border-amber-500/30"
                            : isMatched
                            ? "bg-card border-border/80"
                            : "bg-muted/40 border-dashed border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">
                                {item.rawName}
                              </span>
                              {item.barcodeOrCode && (
                                <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {item.barcodeOrCode}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Qty: <span className="font-bold text-foreground">{item.qty}</span> • Harga Beli Nota:{" "}
                              <span className="font-bold text-foreground">{formatCurrency(item.unitPrice)}</span> • Total:{" "}
                              <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
                            </p>

                            {/* Status matching & Kenaikan Modal */}
                            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                              {matchedProd ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3 w-3" /> Terhubung: {matchedProd.name}
                                </span>
                              ) : item.isMarkedNotInKasir ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  Ditandai Belum Ada di Kasir
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  <HelpCircle className="h-3 w-3" /> Perlu Mapping / Belum Terdaftar
                                </span>
                              )}

                              {isHike && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full">
                                  <AlertTriangle className="h-3 w-3" /> Modal Naik dari {formatCurrency(item.oldCostPrice || 0)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tombol Aksi Item */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {isHike && !item.isAdjustedInKasir && (
                              <Button
                                size="sm"
                                disabled={isLoadingThis}
                                onClick={() => handleConfirmAdjusted(item.id)}
                                className="h-8 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
                              >
                                {isLoadingThis ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                ✓ Sudah Disesuaikan di Kasir
                              </Button>
                            )}

                            {item.isAdjustedInKasir && (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Harga Kasir Sesuai
                              </span>
                            )}

                            {!isMatched && !item.isMarkedNotInKasir && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActiveMappingItemId(activeMappingItemId === item.id ? null : item.id)}
                                  className="h-8 rounded-xl text-xs font-bold border-primary/30 text-primary"
                                >
                                  Pilih Produk Toko...
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMarkNotInKasir(item.id)}
                                  className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Belum Ada di Kasir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleQuickAdd(item)}
                                  className="h-8 rounded-xl text-xs font-bold gap-1"
                                >
                                  <Plus className="h-3 w-3" /> Tambah Baru
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive Selector Dropdown for Mapping */}
                        {activeMappingItemId === item.id && (
                          <div className="mt-3 p-3 rounded-xl bg-card border border-primary/30 space-y-2 animate-in fade-in-50">
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Input
                                placeholder="Cari nama atau barcode barang di database toko..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto divide-y divide-border/50 text-xs">
                              {filteredProducts.length === 0 ? (
                                <p className="py-2 text-center text-muted-foreground italic text-[11px]">
                                  Tidak ada barang ditemukan.
                                </p>
                              ) : (
                                filteredProducts.slice(0, 8).map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={() => handleMapProduct(item.id, p.id)}
                                    className="p-2 flex items-center justify-between hover:bg-primary/5 cursor-pointer rounded-md transition-colors"
                                  >
                                    <div>
                                      <p className="font-bold text-foreground">{p.name}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        Modal: {formatCurrency(p.costPrice)} • Jual: {formatCurrency(p.sellingPrice)}
                                        {p.barcode && ` • Barcode: ${p.barcode}`}
                                      </p>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] font-bold text-primary">
                                      Pilih
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={onClose} className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground">
                  Tutup & Selesai
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
