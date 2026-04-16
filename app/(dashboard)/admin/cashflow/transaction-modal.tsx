"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFinancialTransaction } from "@/app/actions/cashflow";
import { uploadReceipt } from "@/app/actions/upload";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  currentUserId: string;
}

export function TransactionModal({ open, onOpenChange, accounts, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"OUT" | "TRANSFER">("OUT"); // Sederhana: Keluar atau Pindah

  // Form State
  const [amount, setAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [category, setCategory] = useState("Belanja");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Cari dompet pegangan user yang sedang login
  const myWallet = accounts.find(a => a.type === "CASH_ADMIN" && (a as any).userId === currentUserId);
  const bankWallet = accounts.find(a => a.type === "BANK_STORE");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Nominal tidak valid");
      return;
    }
    if (!sourceAccountId) {
      toast.error("Pilih akun sumber dana!");
      return;
    }

    startTransition(async () => {
      let receiptUrl = undefined;

      // Upload file klo ada
      if (file) {
        toast.info("Mengunggah foto struk...");
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await uploadReceipt(formData);
        
        if (!uploadRes.success || !uploadRes.url) {
          toast.error(uploadRes.error || "Gagal mengunggah foto");
          return;
        }
        receiptUrl = uploadRes.url;
      }

      const txType = mode === "OUT" ? "EXPENSE" : "TRANSFER";
      if (mode === "TRANSFER" && !targetAccountId) {
        toast.error("Pilih akun tujuan!");
        return;
      }

      const res = await createFinancialTransaction({
        accountId: sourceAccountId,
        toAccountId: mode === "TRANSFER" ? targetAccountId : undefined,
        type: txType,
        category: mode === "TRANSFER" ? "Transfer/Setoran" : category,
        amount: Number(amount),
        description,
        receiptUrl
      });

      if (res.success) {
        toast.success("Transaksi berhasil dicatat!");
        onOpenChange(false);
        resetForm();
      } else {
        toast.error(res.error || "Terjadi kesalahan");
      }
    });
  }

  function resetForm() {
    setAmount("");
    setDescription("");
    setTargetAccountId("");
    setFile(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Catat Transaksi Kas</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="OUT" onValueChange={(v) => setMode(v as any)} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="OUT">Pengeluaran</TabsTrigger>
            <TabsTrigger value="TRANSFER">Pindah Saldo</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            
            <div className="space-y-2">
              <Label>Sumber Dana</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dompet/bank" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => {
                    const isMine = acc.type === "BANK_STORE" || (acc as any).userId === currentUserId;
                    if (!isMine) return null; // Tidak boleh narik dari akun admin lain
                    return (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} (Saldo: Rp {(acc.balance || 0).toLocaleString('id-ID')})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {mode === "TRANSFER" && (
              <div className="space-y-2">
                <Label>Tujuan Transfer/Setor</Label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih penerima" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} disabled={acc.id === sourceAccountId}>
                        {acc.name} {acc.type === "CASH_ADMIN" ? "(Kasir Admin)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "OUT" && (
              <div className="space-y-2">
                <Label>Kategori Pengeluaran</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Belanja Stok">Belanja Stok</SelectItem>
                    <SelectItem value="Tagihan">Bayar Tagihan</SelectItem>
                    <SelectItem value="Modal Kembalian">Beri Modal Kembalian</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Input
                placeholder="Contoh: Beli sabun 2 dus"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {mode === "OUT" && (
              <div className="space-y-2">
                <Label>Foto Nota / Bukti (Opsional)</Label>
                <Input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Disimpan langsung ke Supabase Storage. Pastikan bucket "receipts" sudah Public.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Menyimpan..." : "Simpan Transaksi"}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
