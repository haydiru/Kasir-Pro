"use client";

import { useState } from "react";
import {
  Package,
  Plus,
  FileSpreadsheet,
  Download,
  Sparkles,
  Search,
  History,
  Edit,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Boxes,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getProducts, deleteProduct } from "@/app/actions/product";
import PriceHistoryModal from "./price-history-modal";
import ExcelImportModal from "./excel-import-modal";
import ReceiptScannerModal from "./receipt-scanner-modal";
import ProductFormDialog from "./product-form-dialog";
import { toast } from "sonner";

interface Props {
  initialProducts: any[];
  totalCount: number;
  unconfirmedHikesCount: number;
  isAiScanEnabled: boolean;
}

export default function ProductsClient({
  initialProducts,
  totalCount: initTotal,
  unconfirmedHikesCount: initHikes,
  isAiScanEnabled,
}: Props) {
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [totalCount, setTotalCount] = useState(initTotal);
  const [unconfirmedHikes, setUnconfirmedHikes] = useState(initHikes);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fetchProducts = async (p = 1, query = search) => {
    setIsLoading(true);
    try {
      const res = await getProducts({ page: p, search: query, limit: 50 });
      if (res.success && res.data) {
        setProducts(res.data.products);
        setTotalCount(res.data.totalCount);
        setPage(p);
      }
    } catch {
      toast.error("Gagal memuat produk");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(1, search);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus barang "${name}"?`)) return;
    try {
      const res = await deleteProduct(id);
      if (res.success) {
        toast.success(`Barang "${name}" berhasil dihapus`);
        fetchProducts(page);
      } else {
        toast.error(res.error || "Gagal menghapus barang");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    }
  };

  // Calculations for metric cards
  const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalAssetValue = products.reduce((acc, p) => acc + (p.costPrice * (p.stock || 0)), 0);
  const lowStockCount = products.filter((p) => p.stock < 5).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            Master Data Barang
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              Katalog Toko
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola kode barcode, harga modal, harga jual, dan pantau riwayat kenaikan harga barang otomatis.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 text-xs font-bold border-border/80 hover:border-primary/50 shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Import Excel
          </Button>

          <a
            href="/api/products/export"
            download
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-background border border-border/80 hover:border-primary/50 text-xs font-bold text-foreground shadow-xs transition-all"
          >
            <Download className="h-4 w-4 text-primary" />
            Export Excel
          </a>

          <Button
            variant="outline"
            onClick={() => setIsScannerOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 text-xs font-bold border-purple-500/30 text-purple-700 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/15 shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            Scan Nota (AI)
          </Button>

          <Button
            onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
            className="h-10 rounded-xl px-5 gap-2 text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tambah Barang
          </Button>
        </div>
      </div>

      {/* Upwork Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Produk</p>
              <p className="text-2xl font-black tracking-tight text-foreground mt-1">{totalCount}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modal Naik (Alert)</p>
              <p className="text-2xl font-black tracking-tight text-amber-600 mt-1">{unconfirmedHikes}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-2xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Aset Modal</p>
              <p className="text-xl font-black tracking-tight text-foreground mt-1 truncate">
                {formatCurrency(totalAssetValue)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stok Kritis (&lt; 5)</p>
              <p className="text-2xl font-black tracking-tight text-rose-600 mt-1">{lowStockCount}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 shadow-2xs">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan nama barang, nomor barcode, atau ID SKU..."
              className="h-10 pl-10 rounded-xl border-border/80 text-xs font-medium"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            className="h-10 px-6 rounded-xl text-xs font-bold bg-primary text-primary-foreground shrink-0 shadow-xs"
          >
            {isLoading ? "Mencari..." : "Cari Barang"}
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border/50 h-14">
                <TableHead className="font-black text-xs uppercase tracking-widest pl-6">
                  Identitas Barang
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-center">
                  Stok & Satuan
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-right">
                  Harga Modal
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-right">
                  Harga Jual
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-center">
                  Margin Laba
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-center">
                  Histori Modal
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-center pr-6">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs font-semibold text-foreground">Memuat data barang...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground italic">
                    Belum ada data barang. Klik "+ Tambah Barang" atau "Import Excel" untuk memulai.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => {
                  const marginNominal = p.sellingPrice - p.costPrice;
                  const marginPct = p.sellingPrice > 0 ? (marginNominal / p.sellingPrice) * 100 : 0;
                  const lastHike = p.priceHistory?.[0]?.difference > 0 && !p.priceHistory?.[0]?.isConfirmed;

                  return (
                    <TableRow key={p.id} className="border-border/20 hover:bg-primary/5 transition-all h-14">
                      {/* Name & Codes */}
                      <TableCell className="pl-6">
                        <div className="flex flex-col max-w-[280px]">
                          <span className="text-sm font-bold text-foreground truncate">{p.name}</span>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-mono">
                            {p.barcode && (
                              <span className="bg-muted px-1.5 py-0.2 rounded font-semibold text-foreground">
                                🏷️ {p.barcode}
                              </span>
                            )}
                            {p.itemCode && <span>SKU: {p.itemCode}</span>}
                          </div>
                        </div>
                      </TableCell>

                      {/* Stock & Unit */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.stock < 5
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {p.stock} {p.unit || "PCS"}
                        </span>
                      </TableCell>

                      {/* Cost Price */}
                      <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                        {formatCurrency(p.costPrice)}
                      </TableCell>

                      {/* Selling Price */}
                      <TableCell className="text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.sellingPrice)}
                      </TableCell>

                      {/* Margin % */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            marginPct >= 15
                              ? "bg-emerald-500/10 text-emerald-600"
                              : marginPct >= 5
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {marginPct.toFixed(1)}%
                        </span>
                      </TableCell>

                      {/* History / Status Alert */}
                      <TableCell className="text-center">
                        {lastHike ? (
                          <button
                            type="button"
                            onClick={() => setHistoryProductId(p.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors animate-pulse cursor-pointer"
                            title="Modal naik! Klik untuk verifikasi"
                          >
                            <AlertTriangle className="h-3 w-3" /> Modal Naik!
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setHistoryProductId(p.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          >
                            <History className="h-3 w-3" /> Lihat
                          </button>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center pr-6">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryProductId(p.id)}
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary"
                            title="Riwayat Perubahan Harga"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsFormOpen(true);
                            }}
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                            title="Edit Barang"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(p.id, p.name)}
                            className="h-8 w-8 p-0 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                            title="Hapus Barang"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modals */}
      <ProductFormDialog
        open={isFormOpen}
        product={editingProduct}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => fetchProducts(page)}
      />

      <PriceHistoryModal
        productId={historyProductId}
        onClose={() => setHistoryProductId(null)}
        onUpdated={() => fetchProducts(page)}
      />

      <ExcelImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => fetchProducts(1)}
      />

      <ReceiptScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onSuccess={() => fetchProducts(page)}
      />
    </div>
  );
}
