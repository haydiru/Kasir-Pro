"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { toggleAiReceiptScan } from "@/app/actions/store";
import { toast } from "sonner";

interface Props {
  initialEnabled: boolean;
}

export default function AiReceiptScanSection({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    const nextVal = !enabled;
    setIsLoading(true);
    try {
      const res = await toggleAiReceiptScan(nextVal);
      if (res.success) {
        setEnabled(nextVal);
        toast.success(res.message);
      } else {
        toast.error(res.error || "Gagal mengubah status fitur");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <span>Ekstraksi Nota AI & Pemantauan Kenaikan Modal</span>
          </CardTitle>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              enabled
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {enabled ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Aktif
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                Nonaktif (Default)
              </>
            )}
          </span>
        </div>
        <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          Didukung oleh Vision AI <strong>GPT Luna</strong> via OpenRouter. Mengekstrak rincian belanja dari foto nota struk kasir/supplier secara otomatis dan mendeteksi kenaikan harga modal produk toko.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-foreground min-w-[120px]">• Saat Nonaktif:</span>
            <span className="text-muted-foreground">
              Pengunggahan foto nota belanja kasir bersifat <strong>opsional</strong>. Fitur ekstraksi AI tidak dijalankan (kondisi default sedia kala).
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-foreground min-w-[120px]">• Saat Aktif:</span>
            <span className="text-muted-foreground">
              Kasir/pegawai <strong>wajib mengunggah foto nota</strong> saat mencatat pengeluaran belanja/supplier. AI otomatis mengekstrak barang, membandingkan harga modal dengan database, dan memunculkan peringatan jika ada modal yang naik.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-semibold text-foreground">
            Status Operasional Toko Ini
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              enabled ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            role="switch"
            aria-checked={enabled}
          >
            {isLoading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              </span>
            ) : (
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
