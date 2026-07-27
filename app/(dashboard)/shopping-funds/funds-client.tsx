"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Eye,
  Camera,
  FileImage,
  Loader2,
  AlertCircle,
  Building,
  Calendar,
  User,
  Info,
  X,
  Sparkles,
  ChevronRight,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { uploadReceipt } from "@/app/actions/upload";
import { allocateShoppingFund, createShoppingExpense, deleteShoppingFund, deleteShoppingExpense, getShoppingFundsData } from "@/app/actions/shopping-funds";

interface UserStat {
  userId: string;
  name: string;
  role: string;
  totalReceived: number;
  totalSpent: number;
  balance: number;
}

interface FundAllocation {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  evidenceUrl: string | null;
  notes: string | null;
  createdAt: string;
  user: { name: string };
}

interface ShoppingExpense {
  id: string;
  userId: string;
  companyName: string;
  totalPrice: number;
  receiptUrl: string;
  notes: string | null;
  createdAt: string;
  user: { name: string };
}

interface Props {
  initialData: {
    users: { id: string; name: string; role: string }[];
    funds: FundAllocation[];
    expenses: ShoppingExpense[];
    statistics: UserStat[];
    currentUser: { id: string; role: string; isAdmin: boolean; isSuperAdmin?: boolean };
  };
}

// Format Currency
function formatIdr(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

// Format Date
function formatFriendlyDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    };
    return date.toLocaleDateString("id-ID", options);
  } catch {
    return dateStr;
  }
}

// Client-side Image Compressor
function compressImage(file: File, maxWidth = 1400, maxHeight = 1400, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    // Skip if not an image
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // hitung aspect ratio baru
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Bikin file baru hasil kompresi
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: "image/jpeg",
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export default function FundsClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  // Dialog States
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);

  // Fund Form State (Admin Only)
  const [fundUserId, setFundUserId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundMethod, setFundMethod] = useState<"CASH" | "TRANSFER">("TRANSFER");
  const [fundNotes, setFundNotes] = useState("");
  const [fundFile, setFundFile] = useState<File | null>(null);
  const [fundFilePreview, setFundFilePreview] = useState<string | null>(null);
  const [isCompresingFund, setIsCompresingFund] = useState(false);

  // Expense Form State (Pegawai)
  const [expenseCompany, setExpenseCompany] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [expenseFilePreview, setExpenseFilePreview] = useState<string | null>(null);
  const [isCompresingExpense, setIsCompresingExpense] = useState(false);

  // Search & Filter state
  const [selectedUserFilter, setSelectedUserFilter] = useState("ALL");

  const isAdmin = data.currentUser.isAdmin;
  const isSuperAdmin = data.currentUser.isSuperAdmin || data.currentUser.role === "super_admin";

  function handleDeleteExpense(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus laporan belanja ini?")) return;
    startTransition(async () => {
      const res = await deleteShoppingExpense(id);
      if (res.success) {
        toast.success("Laporan belanja berhasil dihapus!");
        refreshData(true);
      } else {
        toast.error(res.error || "Gagal menghapus laporan belanja");
      }
    });
  }

  function handleDeleteFund(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi pemberian dana ini?")) return;
    startTransition(async () => {
      const res = await deleteShoppingFund(id);
      if (res.success) {
        toast.success("Transaksi pemberian dana berhasil dihapus!");
        refreshData(true);
      } else {
        toast.error(res.error || "Gagal menghapus pemberian dana");
      }
    });
  }

  // Refresh Data helper
  async function refreshData(silent = false) {
    if (!silent) toast.info("Memperbarui data...");
    const res = await getShoppingFundsData();
    if (res.success && res.data) {
      setData(res.data);
      if (!silent) toast.success("Data berhasil diperbarui!");
    } else {
      toast.error(res.error || "Gagal memuat ulang data");
    }
  }

  // Handle Fund File Selection
  async function handleFundFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    setIsCompresingFund(true);
    const sizeBefore = (file.size / 1024 / 1024).toFixed(2);
    
    try {
      const compressed = await compressImage(file);
      const sizeAfter = (compressed.size / 1024 / 1024).toFixed(2);
      
      setFundFile(compressed);
      setFundFilePreview(URL.createObjectURL(compressed));
      
      toast.success(`Foto dioptimalkan: dari ${sizeBefore}MB menjadi ${sizeAfter}MB (Lebih hemat data)`);
    } catch {
      setFundFile(file);
      setFundFilePreview(URL.createObjectURL(file));
    } finally {
      setIsCompresingFund(false);
    }
  }

  // Handle Expense File Selection
  async function handleExpenseFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    setIsCompresingExpense(true);
    const sizeBefore = (file.size / 1024 / 1024).toFixed(2);

    try {
      const compressed = await compressImage(file);
      const sizeAfter = (compressed.size / 1024 / 1024).toFixed(2);

      setExpenseFile(compressed);
      setExpenseFilePreview(URL.createObjectURL(compressed));

      toast.success(`Nota dioptimalkan: dari ${sizeBefore}MB menjadi ${sizeAfter}MB (Tulisan tetap terbaca jelas)`);
    } catch {
      setExpenseFile(file);
      setExpenseFilePreview(URL.createObjectURL(file));
    } finally {
      setIsCompresingExpense(false);
    }
  }

  // --- SUBMIT PEMBERIAN UANG (Admin/Owner Only) ---
  function handleFundSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fundUserId) {
      toast.error("Silakan pilih pegawai penerima dana");
      return;
    }
    if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) {
      toast.error("Nominal uang harus valid dan lebih dari Rp 0");
      return;
    }

    startTransition(async () => {
      let evidenceUrl = null;

      // Upload file jika ada
      if (fundFile) {
        toast.info("Mengunggah bukti transfer...");
        const formData = new FormData();
        formData.append("file", fundFile);
        const uploadRes = await uploadReceipt(formData);
        
        if (!uploadRes.success || !uploadRes.url) {
          toast.error(uploadRes.error || "Gagal mengunggah bukti transfer");
          return;
        }
        evidenceUrl = uploadRes.url;
      }

      const res = await allocateShoppingFund({
        userId: fundUserId,
        amount: Number(fundAmount),
        paymentMethod: fundMethod,
        evidenceUrl,
        notes: fundNotes || null
      });

      if (res.success) {
        toast.success("Dana belanja operasional berhasil dialokasikan!");
        setIsFundModalOpen(false);
        // Reset form
        setFundUserId("");
        setFundAmount("");
        setFundMethod("TRANSFER");
        setFundNotes("");
        setFundFile(null);
        setFundFilePreview(null);
        refreshData(true);
      } else {
        toast.error(res.error || "Gagal memproses alokasi dana");
      }
    });
  }

  // --- SUBMIT LAPORAN BELANJA (Pegawai/Admin) ---
  function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseCompany.trim()) {
      toast.error("Tuliskan nama tempat belanja!");
      return;
    }
    if (!expenseAmount || isNaN(Number(expenseAmount)) || Number(expenseAmount) <= 0) {
      toast.error("Total nominal belanja harus valid!");
      return;
    }
    if (!expenseFile) {
      toast.error("Wajib foto nota belanja!");
      return;
    }

    startTransition(async () => {
      toast.info("Menyimpan laporan belanja...");
      const formData = new FormData();
      formData.append("file", expenseFile);
      const uploadRes = await uploadReceipt(formData);
      
      if (!uploadRes.success || !uploadRes.url) {
        toast.error(uploadRes.error || "Gagal mengunggah foto nota");
        return;
      }

      const res = await createShoppingExpense({
        companyName: expenseCompany,
        totalPrice: Number(expenseAmount),
        receiptUrl: uploadRes.url,
        notes: expenseNotes || null
      });

      if (res.success) {
        toast.success("Laporan belanja berhasil dicatat!");
        setIsExpenseModalOpen(false);
        // Reset form
        setExpenseCompany("");
        setExpenseAmount("");
        setExpenseNotes("");
        setExpenseFile(null);
        setExpenseFilePreview(null);
        refreshData(true);
      } else {
        toast.error(res.error || "Gagal menyimpan laporan belanja");
      }
    });
  }

  // Agregasi statistik dana
  const totalStats = data.statistics.reduce(
    (acc, cur) => {
      const isTarget = isAdmin || cur.userId === data.currentUser.id;
      if (isTarget) {
        acc.received += cur.totalReceived;
        acc.spent += cur.totalSpent;
        acc.balance += cur.balance;
      }
      return acc;
    },
    { received: 0, spent: 0, balance: 0 }
  );

  // Filter Data
  const filteredFunds = data.funds.filter((f) => {
    if (selectedUserFilter === "ALL") return true;
    return (f as any).userId === selectedUserFilter;
  });

  const filteredExpenses = data.expenses.filter((e) => {
    if (selectedUserFilter === "ALL") return true;
    return (e as any).userId === selectedUserFilter;
  });

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" />
            Laporan Belanja Pegawai (Petty Cash)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pencatatan keuangan uang operasional belanja toko di luar kas mesin kasir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshData(false)} className="h-9 rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" />
            Perbarui
          </Button>

          {isAdmin && (
            <Button size="sm" onClick={() => setIsFundModalOpen(true)} className="h-9 rounded-xl bg-primary text-primary-foreground font-semibold">
              <Plus className="h-4 w-4 mr-1.5" />
              Beri Uang Operasional
            </Button>
          )}

          <Button size="sm" onClick={() => setIsExpenseModalOpen(true)} className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Buat Laporan Belanja
          </Button>
        </div>
      </div>

      {/* Global / Personal Stats Dashboard */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {isAdmin ? "Total Uang Didistribusikan" : "Total Uang Diterima"}
            </CardTitle>
            <ArrowDownLeft className="h-4.5 w-4.5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
              {formatIdr(totalStats.received)}
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
              Akumulasi keseluruhan dana belanja operasional.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-500/5 to-rose-500/10 border border-rose-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-rose-800 dark:text-rose-300">
              Total Dibelanjakan
            </CardTitle>
            <ArrowUpRight className="h-4.5 w-4.5 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-900 dark:text-rose-100">
              {formatIdr(totalStats.spent)}
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 font-medium">
              Pengeluaran belanja resmi yang dilaporkan nota fisiknya.
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm bg-gradient-to-br border ${
          totalStats.balance >= 0 
            ? "from-blue-500/5 to-blue-500/10 border-blue-500/15 text-blue-900 dark:text-blue-100" 
            : "from-amber-500/5 to-amber-500/10 border-amber-500/15 text-amber-900 dark:text-amber-100"
        }`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-bold ${
              totalStats.balance >= 0 ? "text-blue-800 dark:text-blue-300" : "text-amber-800 dark:text-amber-300"
            }`}>
              {isAdmin ? "Sisa Dana Operasional Aktif" : "Sisa Saldo Anda"}
            </CardTitle>
            <Wallet className="h-4.5 w-4.5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {formatIdr(totalStats.balance)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              {totalStats.balance >= 0 
                ? "Sisa saldo tersisa di tangan pegawai." 
                : "⚠️ Peringatan: Total pengeluaran melebihi dana yang diterima!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Panel: Employee Statistics Table */}
      {isAdmin && (
        <Card className="border border-border/80 shadow-sm rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-black tracking-tight">Statistik Saldo Pegawai</CardTitle>
            <CardDescription className="text-xs">
              Menampilkan saldo yang dipegang oleh masing-masing pegawai di toko Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                    <th className="p-3 pl-6">Nama Pegawai</th>
                    <th className="p-3">Jabatan</th>
                    <th className="p-3 text-right">Uang Diterima</th>
                    <th className="p-3 text-right">Uang Dibelanjakan</th>
                    <th className="p-3 text-right">Sisa Saldo</th>
                    <th className="p-3 text-center pr-6">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.statistics.map((stat) => (
                    <tr key={stat.userId} className="hover:bg-muted/10 transition">
                      <td className="p-3 pl-6 font-bold flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                          {stat.name.slice(0, 2).toUpperCase()}
                        </div>
                        {stat.name}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="capitalize text-[10px] py-0 h-4.5 font-bold">
                          {stat.role.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-600">
                        {formatIdr(stat.totalReceived)}
                      </td>
                      <td className="p-3 text-right font-semibold text-rose-600">
                        {formatIdr(stat.totalSpent)}
                      </td>
                      <td className={`p-3 text-right font-extrabold ${stat.balance < 0 ? "text-rose-500" : "text-primary"}`}>
                        {formatIdr(stat.balance)}
                      </td>
                      <td className="p-3 text-center pr-6">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFundUserId(stat.userId);
                            setIsFundModalOpen(true);
                          }}
                          className="h-8 rounded-lg text-xs font-semibold"
                        >
                          Beri Uang
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data.statistics.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-muted-foreground text-xs font-medium">
                        Tidak ada data pegawai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Lists with Filters */}
      <Tabs defaultValue="expenses" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b pb-2">
          <TabsList className="bg-muted/40 p-1 rounded-xl h-11 self-start">
            <TabsTrigger value="expenses" className="rounded-lg text-xs font-bold px-4 py-2">
              Laporan Belanja
            </TabsTrigger>
            <TabsTrigger value="allocations" className="rounded-lg text-xs font-bold px-4 py-2">
              Riwayat Dana Diberikan
            </TabsTrigger>
          </TabsList>

          {/* Admin User Filter Dropdown */}
          {isAdmin && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Label className="text-xs font-bold text-muted-foreground shrink-0">Filter Pegawai:</Label>
              <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                <SelectTrigger className="w-48 h-9 rounded-xl text-xs bg-white dark:bg-card border-border">
                  <SelectValue placeholder="Semua Pegawai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Pegawai</SelectItem>
                  {data.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Tab 1: Laporan Belanja List */}
        <TabsContent value="expenses" className="pt-4">
          <div className="grid gap-3">
            {filteredExpenses.map((exp) => (
              <Card key={exp.id} className="overflow-hidden border border-border/80 shadow-sm hover:border-border transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                      <Building className="h-5.5 w-5.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold tracking-tight text-foreground truncate block max-w-sm">
                          {exp.companyName}
                        </span>
                        <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none font-extrabold text-[9px] h-4.5 py-0 px-1.5 uppercase">
                          Belanja
                        </Badge>
                      </div>

                      <div className="text-[11px] text-muted-foreground font-semibold flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          {formatFriendlyDate(exp.createdAt)}
                        </span>
                        {isAdmin && (
                          <span className="flex items-center gap-0.5 text-foreground/80">
                            <User className="h-3 w-3" />
                            Oleh: {exp.user.name}
                          </span>
                        )}
                        {exp.notes && (
                          <span className="text-foreground/90 bg-muted px-1.5 py-0.5 rounded text-[10px]">
                            Catatan: {exp.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span className="text-lg font-black text-rose-600">
                      -{formatIdr(exp.totalPrice)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveReceiptUrl(exp.receiptUrl)}
                      className="h-8.5 rounded-lg px-2.5 text-xs font-semibold gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Nota
                    </Button>
                    {(isSuperAdmin || isAdmin || exp.userId === data.currentUser.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="h-8.5 w-8.5 p-0 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950"
                        title="Hapus Laporan Belanja"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredExpenses.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-card rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-xs font-bold">Belum ada laporan belanja</p>
                <p className="text-[10px] max-w-xs">
                  Semua pengeluaran belanja pegawai di luar kasir akan tercatat di sini jika dilaporkan.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: allocations List */}
        <TabsContent value="allocations" className="pt-4">
          <div className="grid gap-3">
            {filteredFunds.map((fund) => (
              <Card key={fund.id} className="overflow-hidden border border-border/80 shadow-sm hover:border-border transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <ArrowDownLeft className="h-5.5 w-5.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold tracking-tight text-foreground truncate block max-w-sm">
                          Uang Operasional Pegawai
                        </span>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] py-0 h-4.5 font-bold uppercase">
                          {fund.paymentMethod === "CASH" ? "💵 Cash" : "💳 Transfer"}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-muted-foreground font-semibold flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          {formatFriendlyDate(fund.createdAt)}
                        </span>
                        <span className="flex items-center gap-0.5 text-foreground/80">
                          <User className="h-3 w-3" />
                          Penerima: {fund.user.name}
                        </span>
                        {fund.notes && (
                          <span className="text-foreground/90 bg-muted px-1.5 py-0.5 rounded text-[10px]">
                            Catatan: {fund.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span className="text-lg font-black text-emerald-600">
                      +{formatIdr(fund.amount)}
                    </span>
                    {fund.evidenceUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveReceiptUrl(fund.evidenceUrl)}
                        className="h-8.5 rounded-lg px-2.5 text-xs font-semibold gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Bukti
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-medium italic">Tidak ada foto</span>
                    )}
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteFund(fund.id)}
                        className="h-8.5 w-8.5 p-0 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950"
                        title="Hapus Pemberian Dana (Super Admin Only)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredFunds.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-card rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-xs font-bold">Belum ada riwayat penerimaan dana</p>
                <p className="text-[10px] max-w-xs">
                  Riwayat pemberian uang belanja operasional dari Owner kepada pegawai akan tampil di sini.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- DIALOG 1: BERI DANA BELANJA (ADMIN ONLY) --- */}
      <Dialog open={isFundModalOpen} onOpenChange={setIsFundModalOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Kirim Uang Belanja Pegawai
            </DialogTitle>
            <DialogDescription className="text-xs">
              Catat pemberian uang tunai atau transfer bank untuk dipegang oleh salah satu pegawai.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFundSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Pegawai Penerima Uang <span className="text-rose-500">*</span></Label>
              <Select value={fundUserId} onValueChange={setFundUserId}>
                <SelectTrigger className="rounded-xl h-10 bg-muted/20">
                  <SelectValue placeholder="Pilih Pegawai" />
                </SelectTrigger>
                <SelectContent>
                  {data.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nominal Uang (Rp) <span className="text-rose-500">*</span></Label>
              <Input
                type="number"
                min="1"
                placeholder="Masukkan nominal, misal: 250000"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Metode Penyaluran <span className="text-rose-500">*</span></Label>
              <Tabs defaultValue="TRANSFER" value={fundMethod} onValueChange={(v) => setFundMethod(v as any)} className="w-full">
                <TabsList className="grid grid-cols-2 p-1 bg-muted/40 rounded-xl h-10">
                  <TabsTrigger value="TRANSFER" className="rounded-lg text-xs font-bold py-1.5">💳 Transfer Bank</TabsTrigger>
                  <TabsTrigger value="CASH" className="rounded-lg text-xs font-bold py-1.5">💵 Cash / Tunai</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Foto Bukti Transfer (Opsional)</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFundFileChange}
                    className="hidden"
                    id="fund-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCompresingFund}
                    onClick={() => document.getElementById("fund-file-input")?.click()}
                    className="rounded-xl h-10 text-xs font-bold flex items-center gap-2 border-dashed flex-1 bg-muted/10 border-muted-foreground/30 hover:bg-muted/25"
                  >
                    {isCompresingFund ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Mengompresi Foto...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        {fundFile ? "Ganti Foto Bukti" : "Ambil Foto / Unggah Bukti"}
                      </>
                    )}
                  </Button>
                  {fundFile && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setFundFile(null); setFundFilePreview(null); }} className="h-10 w-10 text-rose-500 rounded-xl hover:bg-rose-50">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Pre-submit preview */}
                {fundFilePreview && (
                  <div className="relative mt-1 rounded-xl overflow-hidden border border-border bg-slate-50/50 max-h-[140px] flex items-center justify-center p-2">
                    <img src={fundFilePreview} alt="Preview" className="max-h-[120px] object-contain rounded-lg" />
                    <button
                      type="button"
                      onClick={() => { setFundFile(null); setFundFilePreview(null); }}
                      className="absolute top-2 right-2 bg-black/75 hover:bg-black/90 text-white rounded-full p-1 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Catatan Tambahan (Opsional)</Label>
              <Textarea
                placeholder="Contoh: Titipan untuk belanja mingguan sabun & alat kebersihan toko."
                value={fundNotes}
                onChange={(e) => setFundNotes(e.target.value)}
                className="rounded-xl bg-muted/20 min-h-[60px] text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsFundModalOpen(false)} className="rounded-xl h-10 text-xs font-bold">
                Batal
              </Button>
              <Button type="submit" disabled={isPending || isCompresingFund} className="rounded-xl h-10 text-xs font-bold bg-primary text-primary-foreground">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Kirim Dana 🚀"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 2: BUAT LAPORAN BELANJA (EMPLOYEE / ALL) --- */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ArrowUpRight className="h-5 w-5" />
              Lapor Pengeluaran Belanja
            </DialogTitle>
            <DialogDescription className="text-xs">
              Laporkan pembelian barang operasional toko menggunakan petty cash Anda. Foto nota belanja wajib diunggah.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExpenseSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nama Tempat Belanja / Toko <span className="text-rose-500">*</span></Label>
              <Input
                placeholder="Contoh: Toko Bangunan Subur, Supermarket Indah"
                value={expenseCompany}
                onChange={(e) => setExpenseCompany(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Total Harga Belanja (Rp) <span className="text-rose-500">*</span></Label>
              <Input
                type="number"
                min="1"
                placeholder="Nominal di nota belanja"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                className="h-10 rounded-xl bg-muted/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                Foto Bukti Struk/Nota <span className="text-rose-500">*</span>
                <span className="text-[10px] font-normal text-muted-foreground bg-slate-100 dark:bg-card px-2 py-0.5 rounded border">Bisa dari Kamera</span>
              </Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleExpenseFileChange}
                    className="hidden"
                    id="expense-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCompresingExpense}
                    onClick={() => document.getElementById("expense-file-input")?.click()}
                    className={`rounded-xl h-10 text-xs font-bold flex items-center gap-2 border-dashed flex-1 bg-muted/10 hover:bg-muted/25 ${
                      !expenseFile ? "border-rose-400 text-rose-500 bg-rose-500/[0.02]" : "border-muted-foreground/30 text-foreground"
                    }`}
                  >
                    {isCompresingExpense ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600 mr-1" />
                        Mengoptimalkan Ukuran Foto...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        {expenseFile ? "Ganti Foto Nota" : "Ambil Foto / Unggah Nota"}
                      </>
                    )}
                  </Button>
                  {expenseFile && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setExpenseFile(null); setExpenseFilePreview(null); }} className="h-10 w-10 text-rose-500 rounded-xl hover:bg-rose-50">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Pre-submit preview */}
                {expenseFilePreview && (
                  <div className="relative mt-1 rounded-xl overflow-hidden border border-border bg-slate-50/50 max-h-[220px] flex flex-col items-center justify-center p-2 gap-1.5">
                    <img src={expenseFilePreview} alt="Preview Nota" className="max-h-[160px] object-contain rounded-lg shadow-sm" />
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                      <Sparkles className="h-3 w-3" />
                      Siap Dikirim (Kualitas Tulisan Terbaca Jelas)
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 leading-none font-medium">
                <Info className="h-3 w-3 text-muted-foreground" />
                Nota belanja wajib diupload agar data pengeluaran disetujui owner.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Detail Barang / Catatan (Opsional)</Label>
              <Textarea
                placeholder="Contoh: Beli lampu Philips 3 biji untuk kasir, sapu lidi 1, lap pel 1."
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="rounded-xl bg-muted/20 min-h-[60px] text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsExpenseModalOpen(false)} className="rounded-xl h-10 text-xs font-bold">
                Batal
              </Button>
              <Button type="submit" disabled={isPending || isCompresingExpense} className="rounded-xl h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Kirim Laporan Belanja 🚀"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 3: PREVIEW BUKTI / NOTA --- */}
      <Dialog open={activeReceiptUrl !== null} onOpenChange={(open) => { if (!open) setActiveReceiptUrl(null); }}>
        <DialogContent className="max-w-xs sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight flex items-center gap-1.5">
              <FileImage className="h-5 w-5 text-primary" />
              Bukti Foto Transaksi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Berikut adalah foto nota atau struk transfer yang diunggah ke sistem.
            </DialogDescription>
          </DialogHeader>

          {activeReceiptUrl && (
            <div className="my-2 rounded-xl overflow-hidden border bg-muted/10 max-h-[360px] flex items-center justify-center">
              <img
                src={activeReceiptUrl}
                alt="Bukti Foto Nota"
                className="object-contain max-h-[360px] w-full"
                onError={(e) => {
                  toast.error("Gagal memuat gambar. Silakan buka link langsung.");
                }}
              />
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeReceiptUrl) window.open(activeReceiptUrl, "_blank");
              }}
              className="w-full sm:w-auto text-xs font-bold rounded-xl h-10"
            >
              Buka Gambar di Tab Baru ↗
            </Button>
            <Button
              type="button"
              onClick={() => setActiveReceiptUrl(null)}
              className="w-full sm:w-auto text-xs font-bold rounded-xl h-10 bg-primary text-primary-foreground"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
