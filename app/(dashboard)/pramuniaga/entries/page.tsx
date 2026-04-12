"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Wallet,
  CreditCard,
  Send,
  Smartphone,
  ShoppingBag,
  UploadCloud,
  FileEdit,
  Save
} from "lucide-react";
import { type DigitalTransaction, type Expenditure } from "@/lib/mock-data";
import { formatCurrency, formatDateTime, getRoleLabel } from "@/lib/utils";
import { toast } from "sonner";
import { addShiftEntries, updateDigitalEntry, updateExpenditureEntry, deleteShiftEntry, getShiftTeamEntries } from "@/app/actions/report";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserSquare2, Calculator, AlertCircle } from "lucide-react";

// Helpers
const uid = () => Math.random().toString(36).slice(2, 9);
const emptyDigitalTx = (): DigitalTransaction => ({
  id: uid(),
  serviceType: "Transfer",
  grossAmount: 0,
  profitAmount: 0,
  detailContact: "",
  flipId: "",
  isNonCash: false,
  paymentMethod: "",
});
const emptyExpenditure = (): Expenditure => ({
  id: uid(),
  supplierName: "",
  amountFromBill: 0,
  amountFromCashier: 0,
  amountFromTransfer: 0,
});

export default function PramuniagaEntriesPage() {
  const [digitalTx, setDigitalTx] = useState<DigitalTransaction[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncedDigitalTx, setSyncedDigitalTx] = useState<any[]>([]);
  const [syncedExpenditures, setSyncedExpenditures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const loadActiveShiftData = async () => {
    try {
      const res = await getShiftTeamEntries();
      if (res.success && res.data) {
        setSyncedDigitalTx(res.data.digitalTransactions || []);
        setSyncedExpenditures(res.data.expenditures || []);
      }
    } catch (err) {
      toast.error("Gagal memuat riwayat shift.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveShiftData();
  }, []);

  // Digital Handlers
  const addDigitalRow = () => setDigitalTx([...digitalTx, emptyDigitalTx()]);
  const removeDigitalRow = (id: string) => setDigitalTx(digitalTx.filter((t) => t.id !== id));
  const updateDigitalTx = (id: string, field: keyof DigitalTransaction, value: any) => {
    setDigitalTx(digitalTx.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  // Expenditure Handlers
  const addExpenditure = () => setExpenditures([...expenditures, emptyExpenditure()]);
  const removeExpenditure = (id: string) => setExpenditures(expenditures.filter((e) => e.id !== id));
  const updateExpenditure = (id: string, field: keyof Expenditure, value: any) => {
    setExpenditures(expenditures.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const syncData = async () => {
    if (digitalTx.length === 0 && expenditures.length === 0) {
      toast("Data masih kosong", { description: "Belum ada entri untuk disinkronkan." });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const res = await addShiftEntries({
        digitalTx,
        expenditures
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Data Tersinkron", {
          description: "Entri Anda berhasil diteruskan ke sinkronisasi Laporan Kasir utama.",
        });
        // Clear after successful sync to prevent double submission
        setDigitalTx([]);
        setExpenditures([]);
        // Reload history
        loadActiveShiftData();
      }
    } catch (err) {
      toast.error("Terjadi kesalahan teknis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileEdit className="h-6 w-6 text-primary" />
          Pramuniaga: Entri Data
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Formulir eksklusif untuk memasukkan data Layanan Digital dan Pengeluaran tambahan tanpa mengganggu alur tutup-shift Kasir.
        </p>
      </div>

      <div className="grid gap-6">

        {/* Layanan Digital */}
        <Card className="border-0 shadow-sm border-t-4 border-t-primary/80">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Layanan Digital & Pembayaran
                </CardTitle>
                <CardDescription className="text-xs pt-1">
                  Catat transaksi Top Up, Transfer, Listrik, dsb yang Anda tangani.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addDigitalRow} className="shadow-sm">
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Transaksi
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {digitalTx.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Belum ada entri transaksi digital
              </p>
            ) : (
              <div className="space-y-4">
                {digitalTx.map((tx, idx) => (
                  <div key={tx.id} className="rounded-xl border border-muted-foreground/20 p-4 shadow-sm bg-card space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">
                        Data #{idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeDigitalRow(tx.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Jenis Layanan</Label>
                        <Select
                          value={tx.serviceType}
                          onValueChange={(v) => updateDigitalTx(tx.id, "serviceType", v)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Transfer">Transfer</SelectItem>
                            <SelectItem value="Top Up E-Walet">Top Up E-Walet</SelectItem>
                            <SelectItem value="Pulsa/Paket Data">Pulsa/Paket Data</SelectItem>
                            <SelectItem value="Listrik">Listrik</SelectItem>
                            <SelectItem value="PDAM">PDAM</SelectItem>
                            <SelectItem value="Indihome">Indihome</SelectItem>
                            <SelectItem value="Lainnya">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Modal+Laba (Rp)</Label>
                        <Input
                          type="number"
                          value={tx.grossAmount || ""}
                          onChange={(e) => updateDigitalTx(tx.id, "grossAmount", Number(e.target.value))}
                          className="h-9 text-xs font-mono"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Laba (Rp)</Label>
                        <Input
                          type="number"
                          value={tx.profitAmount || ""}
                          onChange={(e) => updateDigitalTx(tx.id, "profitAmount", Number(e.target.value))}
                          className="h-9 text-xs font-mono"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Detail / Kontak</Label>
                        <Input
                          value={tx.detailContact}
                          onChange={(e) => updateDigitalTx(tx.id, "detailContact", e.target.value)}
                          className="h-9 text-xs"
                          placeholder="No HP / No Rekening / ID Pelanggan"
                        />
                      </div>
                      <div className="lg:col-span-2 space-y-1">
                        <Label className="text-[11px]">ID Flip / Bukti Transaksi</Label>
                        <Input
                          value={tx.flipId}
                          onChange={(e) => updateDigitalTx(tx.id, "flipId", e.target.value)}
                          className="h-9 text-xs font-mono"
                          placeholder="#FTXXXXX"
                        />
                      </div>
                      
                      <div className="lg:col-span-2 flex items-center gap-4 mt-1 lg:mt-6">
                        <label className="flex items-center gap-2 text-xs cursor-pointer font-medium p-2 rounded border border-transparent hover:border-border hover:bg-muted/30 transition-all">
                          <input
                            type="checkbox"
                            checked={tx.isNonCash}
                            onChange={(e) => updateDigitalTx(tx.id, "isNonCash", e.target.checked)}
                            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                          />
                          Mode Non-Tunai
                        </label>
                        {tx.isNonCash && (
                          <Select
                            value={tx.paymentMethod}
                            onValueChange={(v) => updateDigitalTx(tx.id, "paymentMethod", v)}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs border-primary/20 bg-primary/5">
                              <SelectValue placeholder="Pilih Metode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QRIS">QRIS</SelectItem>
                              <SelectItem value="Debit BCA">Debit BCA</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pengeluaran */}
        <Card className="border-0 shadow-sm border-t-4 border-t-rose-500/80">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-rose-500" />
                  Pengeluaran
                </CardTitle>
                <CardDescription className="text-xs pt-1">
                  Tagihan barang, es batu, parkir, dan biaya toko lainnya.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addExpenditure} className="shadow-sm">
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Pengeluaran
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {expenditures.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Belum ada pengeluaran
              </p>
            ) : (
              <div className="space-y-4">
                {expenditures.map((ex, idx) => {
                  const exTotal = ex.amountFromBill + ex.amountFromCashier + ex.amountFromTransfer;
                  return (
                    <div key={ex.id} className="rounded-xl border border-muted-foreground/20 p-4 shadow-sm bg-card space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-semibold bg-rose-500/10 text-rose-600 px-2 py-1 rounded-md">
                          Pengeluaran #{idx + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          {exTotal > 0 && (
                            <Badge variant="outline" className="font-mono bg-background">
                              Total: {formatCurrency(exTotal)}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeExpenditure(ex.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Row 1: Supplier + Upload */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-3 space-y-1">
                          <Label className="text-[11px]">Nama Supplier / Tujuan</Label>
                          <Input
                            value={ex.supplierName}
                            onChange={(e) => updateExpenditure(ex.id, "supplierName", e.target.value)}
                            className="h-9 text-xs"
                            placeholder="Supplier atau Nama Orang"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Bukti Fisik</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-9 text-xs bg-muted/30"
                          >
                            <UploadCloud className="mr-1 h-3 w-3" />
                            Upload Nota
                          </Button>
                        </div>
                      </div>

                      {/* Row 2: 3 Payment Sources */}
                      <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/30 p-3 space-y-2 dark:bg-rose-950/10 dark:border-rose-900/50">
                        <p className="text-[10px] font-semibold text-rose-600/80 uppercase tracking-wider">
                          Rincian Sumber Dana
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] flex items-center gap-1">
                              <Wallet className="h-3 w-3 text-amber-500" />
                              Uang Tagihan (Rp)
                            </Label>
                            <Input
                              type="number"
                              value={ex.amountFromBill || ""}
                              onChange={(e) => updateExpenditure(ex.id, "amountFromBill", Number(e.target.value))}
                              className="h-9 text-xs font-mono bg-background"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] flex items-center gap-1">
                              <CreditCard className="h-3 w-3 text-blue-500" />
                              Uang Kasir (Rp)
                            </Label>
                            <Input
                              type="number"
                              value={ex.amountFromCashier || ""}
                              onChange={(e) => updateExpenditure(ex.id, "amountFromCashier", Number(e.target.value))}
                              className="h-9 text-xs font-mono bg-background"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] flex items-center gap-1">
                              <Send className="h-3 w-3 text-emerald-500" />
                              Transfer (Rp)
                            </Label>
                            <Input
                              type="number"
                              value={ex.amountFromTransfer || ""}
                              onChange={(e) => updateExpenditure(ex.id, "amountFromTransfer", Number(e.target.value))}
                              className="h-9 text-xs font-mono bg-background"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4 sticky bottom-4">
          <Button 
            size="lg" 
            onClick={syncData} 
            disabled={isSubmitting || (digitalTx.length === 0 && expenditures.length === 0)}
            className="shadow-xl"
          >
            {isSubmitting ? (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan & Sinkronkan
          </Button>
        </div>

        {/* RIWAYAT SHIFT AKTIF */}
        <div className="pt-8 border-t">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Riwayat Shift Aktif (Terarsip)
              </h2>
              <p className="text-xs text-muted-foreground">
                Daftar semua entri yang sudah berhasil disinkronkan oleh tim dalam shift ini.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadActiveShiftData} className="text-primary text-xs">
              <Plus className="mr-1 h-3 w-3 rotate-45" /> Refresh Data
            </Button>
          </div>

          <div className="grid gap-6">
             {/* Digital History */}
             <Card className="border-0 shadow-sm bg-muted/30">
                <CardHeader className="py-3 bg-muted/50 border-b">
                  <CardTitle className="text-sm font-semibold">Layanan Digital Terarsip</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {syncedDigitalTx.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-6 text-center italic">Belum ada data tersinkron.</p>
                  ) : (
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                      {syncedDigitalTx.map((tx) => {
                        const isOwner = tx.createdBy === session?.user?.id;
                        const isEditing = editingId === tx.id;

                        if (isEditing) {
                          return (
                            <div key={tx.id} className="p-4 bg-primary/5 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Layanan</Label>
                                        <Select value={editForm.serviceType} onValueChange={(v) => setEditForm({...editForm, serviceType: v})}>
                                            <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Transfer">Transfer</SelectItem>
                                                <SelectItem value="Top Up E-Walet">Top Up E-Walet</SelectItem>
                                                <SelectItem value="Pulsa/Paket Data">Pulsa/Paket Data</SelectItem>
                                                <SelectItem value="Listrik">Listrik</SelectItem>
                                                <SelectItem value="Lainnya">Lainnya</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Nominal (Rp)</Label>
                                        <Input 
                                            type="number" 
                                            className="h-8 text-[11px] font-mono" 
                                            value={editForm.grossAmount} 
                                            onChange={(e) => setEditForm({...editForm, grossAmount: Number(e.target.value)})}
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-[10px]">Kontak / Bukti</Label>
                                        <Input 
                                            className="h-8 text-[11px]" 
                                            value={editForm.detailContact} 
                                            onChange={(e) => setEditForm({...editForm, detailContact: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)} disabled={isUpdating}>Batal</Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={async () => {
                                        setIsUpdating(true);
                                        try {
                                            const res = await updateDigitalEntry(tx.id, editForm);
                                            if (res.success) {
                                              toast.success("Data diperbarui");
                                              setEditingId(null);
                                              loadActiveShiftData();
                                            } else {
                                              toast.error(res.error || "Gagal update");
                                            }
                                        } catch (err) { toast.error("Terjadi kesalahan teknis"); }
                                        finally { setIsUpdating(false); }
                                    }} disabled={isUpdating}>
                                        {isUpdating ? "..." : "Simpan"}
                                    </Button>
                                </div>
                            </div>
                          )
                        }

                        return (
                          <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] h-5">{tx.serviceType}</Badge>
                                <span className="text-sm font-semibold font-mono text-primary">{formatCurrency(tx.grossAmount)}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate max-w-xs">{tx.detailContact || "Tanpa detail"}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex gap-2">
                                    {tx.creator?.name && (
                                      <div className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-[9px] font-medium text-muted-foreground border">
                                        <UserSquare2 className="h-2.5 w-2.5" />
                                        {tx.creator.name}
                                      </div>
                                    )}
                                    {tx.updater?.name && (
                                      <div className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-600 border border-blue-200">
                                        <FileEdit className="h-2.5 w-2.5" />
                                        Diedit: {tx.updater.name}
                                      </div>
                                    )}
                                </div>
                                {tx.isNonCash && <Badge variant="secondary" className="text-[9px] h-4">Non-Tunai ({tx.paymentMethod})</Badge>}
                              </div>
                              {isOwner && (
                                <div className="flex items-center gap-1 pl-2 border-l">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => {
                                      setEditingId(tx.id);
                                      setEditForm({...tx});
                                  }}>
                                    <FileEdit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={async () => {
                                      if (confirm("Hapus data ini permanen?")) {
                                          const res = await deleteShiftEntry("digital", tx.id);
                                          if (res.success) {
                                            toast.success("Data dihapus");
                                            loadActiveShiftData();
                                          } else {
                                            toast.error(res.error || "Gagal menghapus");
                                          }
                                      }
                                  }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
             </Card>

             {/* Expenditure History */}
             <Card className="border-0 shadow-sm bg-muted/30">
                <CardHeader className="py-3 bg-muted/50 border-b">
                  <CardTitle className="text-sm font-semibold">Pengeluaran Terarsip</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {syncedExpenditures.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-6 text-center italic">Belum ada data tersinkron.</p>
                  ) : (
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                      {syncedExpenditures.map((ex) => {
                        const total = ex.amountFromBill + ex.amountFromCashier + ex.amountFromTransfer;
                        const isOwner = ex.createdBy === session?.user?.id;
                        const isEditing = editingId === ex.id;

                        if (isEditing) {
                          return (
                            <div key={ex.id} className="p-4 bg-rose-500/5 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-[10px]">Supplier / Tujuan</Label>
                                        <Input 
                                            className="h-8 text-[11px]" 
                                            value={editForm.supplierName} 
                                            onChange={(e) => setEditForm({...editForm, supplierName: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Tagihan (Rp)</Label>
                                        <Input 
                                            type="number" 
                                            className="h-8 text-[11px] font-mono" 
                                            value={editForm.amountFromBill} 
                                            onChange={(e) => setEditForm({...editForm, amountFromBill: Number(e.target.value)})}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Kasir (Rp)</Label>
                                        <Input 
                                            type="number" 
                                            className="h-8 text-[11px] font-mono" 
                                            value={editForm.amountFromCashier} 
                                            onChange={(e) => setEditForm({...editForm, amountFromCashier: Number(e.target.value)})}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)} disabled={isUpdating}>Batal</Button>
                                    <Button size="sm" className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white" onClick={async () => {
                                        setIsUpdating(true);
                                        try {
                                            const res = await updateExpenditureEntry(ex.id, editForm);
                                            if (res.success) {
                                              toast.success("Pengeluaran diperbarui");
                                              setEditingId(null);
                                              loadActiveShiftData();
                                            } else {
                                              toast.error(res.error || "Gagal update");
                                            }
                                        } catch (err) { toast.error("Terjadi kesalahan teknis"); }
                                        finally { setIsUpdating(false); }
                                    }} disabled={isUpdating}>
                                        {isUpdating ? "..." : "Simpan"}
                                    </Button>
                                </div>
                            </div>
                          )
                        }

                        return (
                          <div key={ex.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{ex.supplierName}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold font-mono text-rose-600">{formatCurrency(total)}</span>
                                <div className="flex gap-1">
                                  {ex.amountFromBill > 0 && <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600">Tagihan</Badge>}
                                  {ex.amountFromCashier > 0 && <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">Kasir</Badge>}
                                  {ex.amountFromTransfer > 0 && <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600">Transfer</Badge>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex gap-2">
                                    {ex.creator?.name && (
                                      <div className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-0.5 text-[9px] font-medium text-muted-foreground border">
                                        <UserSquare2 className="h-2.5 w-2.5" />
                                        {ex.creator.name}
                                      </div>
                                    )}
                                    {ex.updater?.name && (
                                      <div className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[9px] font-medium text-blue-600 border border-blue-200">
                                        <FileEdit className="h-2.5 w-2.5" />
                                        Diedit: {ex.updater.name}
                                      </div>
                                    )}
                                </div>
                              </div>
                              {isOwner && (
                                <div className="flex items-center gap-1 pl-2 border-l">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => {
                                      setEditingId(ex.id);
                                      setEditForm({...ex});
                                  }}>
                                    <FileEdit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={async () => {
                                      if (confirm("Hapus data ini permanen?")) {
                                          const res = await deleteShiftEntry("expenditure", ex.id);
                                          if (res.success) {
                                            toast.success("Data dihapus");
                                            loadActiveShiftData();
                                          } else {
                                            toast.error(res.error || "Gagal menghapus");
                                          }
                                      }
                                  }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
             </Card>

             <div className="flex items-center gap-2 bg-blue-500/5 p-3 rounded-lg border border-blue-200 text-blue-600">
                <AlertCircle className="h-4 w-4" />
                <p className="text-[11px] font-medium">Data riwayat ini bersifat arsip. Hanya Kasir atau Admin yang dapat melakukan koreksi jika terdapat kesalahan input tim.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
