"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExcelImportModal({ open, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Pilih file Excel terlebih dahulu");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Gagal mengimport data Excel");
      } else {
        setResult(data);
        toast.success(data.message || "Import data barang berhasil!");
        onSuccess();
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan saat upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <span>Import Data Barang dari Excel</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload file .xlsx untuk memasukkan atau memperbarui data barang sekaligus secara massal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Download Template Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-primary/5 border border-primary/20">
            <div>
              <p className="text-xs font-bold text-foreground">Format Template Standar</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pastikan kolom berisi: ID_BARANG, KODE_BARCODE, NAMA_BARANG, JUMLAH_STOK, HARGA_MODAL, HARGA_JUAL, SATUAN.
              </p>
            </div>
            <a
              href="/api/products/export"
              download
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-background border border-border/80 text-xs font-bold text-foreground hover:bg-muted transition-all shrink-0 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              Download Template
            </a>
          </div>

          {/* Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              file
                ? "border-primary bg-primary/5"
                : "border-border/80 hover:border-primary/50 bg-muted/20"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">
                {file ? file.name : "Klik atau seret file Excel ke sini"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB — Siap diupload`
                  : "Mendukung format file .xlsx dan .xls"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Batal
            </Button>
            {result ? (
              <Button
                onClick={handleReset}
                className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
              >
                Upload File Lain
              </Button>
            ) : (
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses Data...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Proses Import Sekarang
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Result Summary */}
          {result && (
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>Hasil Pemrosesan File Excel:</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Barang Baru</span>
                  <span className="text-base font-black text-foreground">{result.inserted}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">Diperbarui</span>
                  <span className="text-base font-black text-foreground">{result.updated}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-600 block font-semibold">Modal Naik</span>
                  <span className="text-base font-black text-amber-600">{result.priceHikes}</span>
                </div>
              </div>

              {/* Price Hikes List */}
              {result.priceHikeDetails?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Daftar Barang dengan Kenaikan Harga Modal:
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {result.priceHikeDetails.map((hike: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-muted/60"
                      >
                        <span className="font-semibold text-foreground truncate max-w-[200px]">
                          {hike.name}
                        </span>
                        <div className="text-right shrink-0">
                          <span className="text-muted-foreground line-through text-[10px] mr-1.5">
                            {formatCurrency(hike.oldCost)}
                          </span>
                          <span className="font-bold text-amber-600">
                            ➔ {formatCurrency(hike.newCost)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
