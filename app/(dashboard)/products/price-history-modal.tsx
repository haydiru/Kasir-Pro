"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getProductById, confirmPriceAdjustment } from "@/app/actions/product";
import { formatCurrency } from "@/lib/utils";
import {
  History,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  Edit,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  productId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function PriceHistoryModal({ productId, onClose, onUpdated }: Props) {
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      return;
    }

    setIsLoading(true);
    getProductById(productId)
      .then((res) => {
        if (res.success && res.data) {
          setProduct(res.data);
        } else {
          toast.error(res.error || "Gagal memuat riwayat harga");
        }
      })
      .finally(() => setIsLoading(false));
  }, [productId]);

  const handleConfirm = async (historyId: string) => {
    setConfirmingId(historyId);
    try {
      const res = await confirmPriceAdjustment(historyId);
      if (res.success) {
        toast.success("Penyesuaian harga di kasir berhasil dikonfirmasi!");
        // Update local state
        setProduct((prev: any) => ({
          ...prev,
          priceHistory: prev.priceHistory.map((h: any) =>
            h.id === historyId ? { ...h, isConfirmed: true, confirmedAt: new Date() } : h
          ),
        }));
        if (onUpdated) onUpdated();
      } else {
        toast.error(res.error || "Gagal mengonfirmasi");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setConfirmingId(null);
    }
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case "RECEIPT_AI_SCAN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Receipt className="h-3 w-3" /> Nota AI
          </span>
        );
      case "EXCEL_IMPORT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <FileSpreadsheet className="h-3 w-3" /> Excel
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border">
            <Edit className="h-3 w-3" /> Manual
          </span>
        );
    }
  };

  return (
    <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <span>Riwayat Perubahan Harga Modal & Jual</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Catatan permanen perubahan harga untuk produk:{" "}
            <span className="font-bold text-foreground">{product?.name || "Memuat..."}</span>
            {product?.barcode && ` (Barcode: ${product.barcode})`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs font-semibold">Memuat rekam jejak harga...</span>
          </div>
        ) : !product || product.priceHistory?.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground italic">
            Belum ada riwayat perubahan harga untuk produk ini.
          </div>
        ) : (
          <div className="space-y-4 pt-3">
            {/* Current Price Summary Box */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/40 border border-border/80">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Harga Modal Saat Ini
                </p>
                <p className="text-base font-black text-foreground mt-0.5">
                  {formatCurrency(product.costPrice)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Harga Jual Saat Ini
                </p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(product.sellingPrice)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Margin Keuntungan
                </p>
                <p className="text-base font-black text-primary mt-0.5">
                  {product.sellingPrice > 0
                    ? `${(((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100).toFixed(1)}%`
                    : "0%"}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-border/60">
              {product.priceHistory.map((item: any, idx: number) => {
                const isHike = item.difference > 0;
                return (
                  <div
                    key={item.id || idx}
                    className={`relative pl-8 pb-3 ${
                      idx !== product.priceHistory.length - 1 ? "border-b border-border/40" : ""
                    }`}
                  >
                    {/* Timeline Node */}
                    <div
                      className={`absolute left-1.5 top-1.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-background shadow-xs ${
                        isHike ? "bg-amber-500 ring-2 ring-amber-500/20" : "bg-primary"
                      }`}
                    />

                    <div className="space-y-2 rounded-xl p-3.5 bg-card border border-border/70 hover:border-primary/40 transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getSourceBadge(item.sourceType)}
                          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {item.isConfirmed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Selesai / Terkonfirmasi Kasir
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={confirmingId === item.id}
                            onClick={() => handleConfirm(item.id)}
                            className="h-7 rounded-lg text-[11px] font-bold border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 gap-1.5"
                          >
                            {confirmingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            )}
                            Tandai Sudah Disesuaikan di Kasir
                          </Button>
                        )}
                      </div>

                      {/* Transition info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Modal Lama</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(item.oldCostPrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Modal Baru</span>
                          <span
                            className={`font-black ${
                              isHike ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                            }`}
                          >
                            {formatCurrency(item.newCostPrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Kenaikan</span>
                          <span
                            className={`font-bold inline-flex items-center gap-0.5 ${
                              isHike ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                            }`}
                          >
                            {isHike && <TrendingUp className="h-3 w-3" />}
                            {isHike ? `+${formatCurrency(item.difference)} (+${item.percentage}%)` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Harga Jual</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.newSellingPrice)}
                          </span>
                        </div>
                      </div>

                      {item.reason && (
                        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          Catatan: <span className="font-medium text-foreground">{item.reason}</span>
                        </p>
                      )}

                      {item.receiptUrl && (
                        <div className="pt-1">
                          <a
                            href={item.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Lihat Foto Bukti Nota Belanja
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
