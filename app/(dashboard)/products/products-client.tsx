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
  Store,
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
      {/* Header — 1 Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Master Data Barang
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              Katalog Toko
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Kelola data barang, harga modal & jual, serta riwayat perubahan harga otomatis.
          </p>
        </div>

        {/* Primary Header CTAs */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsScannerOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 text-xs font-bold border-purple-500/30 text-purple-700 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/15 shadow-2xs transition-all"
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            Scan Nota AI
          </Button>

          <Button
            onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
            className="h-10 rounded-xl px-4.5 gap-2 text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Tambah Barang
          </Button>
        </div>
      </div>

      {/* Upwork Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Produk</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{totalCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs shrink-0">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Modal Naik (Alert)</p>
              <p className={`text-2xl font-black tracking-tight ${unconfirmedHikes > 0 ? "text-amber-600" : "text-foreground"}`}>
                {unconfirmedHikes}
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs shrink-0 ${
              unconfirmedHikes > 0 ? "bg-amber-500/10 text-amber-600 animate-pulse" : "bg-muted text-muted-foreground"
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Aset Modal</p>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate max-w-[140px]">
                {formatCurrency(totalAssetValue)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stok Menipis (&lt; 5)</p>
              <p className={`text-2xl font-black tracking-tight ${lowStockCount > 0 ? "text-rose-600" : "text-foreground"}`}>
                {lowStockCount}
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs shrink-0 ${
              lowStockCount > 0 ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
            }`}>
              <Boxes className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search on Left + Excel Import/Export on Right */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama barang, nomor barcode, atau SKU..."
            className="h-10 pl-9.5 pr-16 rounded-xl border-border/80 bg-card text-xs font-medium focus-visible:ring-primary shadow-2xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                fetchProducts(1, "");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded bg-muted"
            >
              Reset
            </button>
          ) : (
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary hover:text-primary/80 cursor-pointer px-2 py-1 rounded-md"
            >
              Cari
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="h-10 rounded-xl px-3.5 gap-2 text-xs font-bold border-border/80 hover:border-primary/50 bg-card shadow-2xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Import Excel
          </Button>

          <a
            href="/api/products/export"
            download
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-xs font-bold text-foreground shadow-2xs transition-all"
          >
            <Download className="h-4 w-4 text-primary" />
            Export Excel
          </a>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package className="h-7 w-7 animate-spin text-primary" />
            <span className="text-xs font-semibold text-foreground">Memuat data barang toko...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 px-4 flex flex-col items-center justify-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <Package className="h-7 w-7 text-muted-foreground/70" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-bold text-foreground">
                {search ? "Barang Tidak Ditemukan" : "Katalog Barang Masih Kosong"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {search
                  ? `Tidak ada produk yang cocok dengan pencarian "${search}". Coba kata kunci lain.`
                  : "Mulai isi data barang toko Anda dengan menambahkan produk satuan atau import massal dari file Excel."}
              </p>
            </div>
            {!search && (
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportOpen(true)}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Import Excel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsFormOpen(true);
                  }}
                  className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Barang
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border/50 h-12">
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider pl-6">
                    Barang & Identitas
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-center">
                    Stok
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">
                    Harga Modal
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-right">
                    Harga Jual
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-center">
                    Margin
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-center">
                    Status Modal
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-center pr-6">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const marginNominal = p.sellingPrice - p.costPrice;
                  const marginPct = p.sellingPrice > 0 ? (marginNominal / p.sellingPrice) * 100 : 0;
                  const lastHike = p.priceHistory?.[0]?.difference > 0 && !p.priceHistory?.[0]?.isConfirmed;

                  return (
                    <TableRow key={p.id} className="border-border/30 hover:bg-primary/5 transition-all h-14">
                      {/* Name & Codes */}
                      <TableCell className="pl-6">
                        <div className="flex flex-col max-w-[300px]">
                          <span className="text-xs sm:text-sm font-bold text-foreground truncate">{p.name}</span>
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
                      <TableCell className="text-right font-mono font-bold text-xs sm:text-sm text-foreground">
                        {formatCurrency(p.costPrice)}
                      </TableCell>

                      {/* Selling Price */}
                      <TableCell className="text-right font-mono font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.sellingPrice)}
                      </TableCell>

                      {/* Margin % */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
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
                })}
            </TableBody>
          </Table>
        </div>
      )}
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
