"use client";

import { useState } from "react";
import { formatCurrency, formatLocalDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionModal } from "./transaction-modal";
import { Wallet, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Search, PlusCircle, ExternalLink } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  userId?: string | null;
}

interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  description?: string | null;
  receiptUrl?: string | null;
  date: string;
  user: { name: string };
  account: { name: string; type: string };
  toAccount?: { name: string; type: string } | null;
}

interface Props {
  initialAccounts: Account[];
  initialTransactions: Transaction[];
  currentUserId: string;
  currentUserRole: string;
  timezone: string;
}

export function CashflowClient({ initialAccounts, initialTransactions, currentUserId, currentUserRole, timezone }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTxs = initialTransactions.filter(tx => 
    tx.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (tx.description && tx.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari transaksi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-white"
          />
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2 shrink-0">
          <PlusCircle className="h-4 w-4" /> Catat Transaksi Baru
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialAccounts.map(acc => {
          const isMine = acc.userId === currentUserId || acc.type === "BANK_STORE";
          // Jika Super Admin, bisa liat semua dompet. Apabila admin biasa, cuma liat miliknya dan bank.
          if (!isMine && currentUserRole !== "super_admin") return null;

          return (
            <Card key={acc.id} className={`border-0 shadow-sm overflow-hidden ${acc.userId === currentUserId ? 'ring-2 ring-primary/20' : ''}`}>
              <div className={`h-1.5 w-full ${acc.type === "BANK_STORE" ? 'bg-blue-500' : 'bg-emerald-500'}`} />
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wider text-[10px] font-bold">
                  {acc.type === "BANK_STORE" ? "Rekening Bersama" : "Kas Pegangan Personal"}
                </CardDescription>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">{acc.name}</CardTitle>
                  <Wallet className={`h-4 w-4 ${acc.type === "BANK_STORE" ? 'text-blue-500' : 'text-emerald-500'}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono tracking-tight">{formatCurrency(acc.balance || 0)}</p>
                {acc.userId === currentUserId && (
                  <Badge variant="secondary" className="mt-2 text-[10px] font-normal">Dompet Anda</Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-0 shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Riwayat Transaksi (Jurnal)</CardTitle>
          <CardDescription>Menampilkan alur mutasi dana masuk dan keluar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Tanggal & Pemroses</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Dompet Asal</TableHead>
                  <TableHead>Dompet Tujuan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTxs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Belum ada transaksi tercatat.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTxs.map((tx) => {
                    const isIncome = tx.type === "INCOME";
                    const isTransfer = tx.type === "TRANSFER";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{formatLocalDate(new Date(tx.date), timezone)}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Oleh: {tx.user.name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 pr-2 uppercase text-[10px] ${
                            isIncome ? 'text-emerald-600 bg-emerald-50' :
                            isTransfer ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'
                          }`}>
                            {isIncome && <ArrowDownRight className="h-3 w-3" />}
                            {isTransfer && <ArrowRightLeft className="h-3 w-3" />}
                            {!isIncome && !isTransfer && <ArrowUpRight className="h-3 w-3" />}
                            {tx.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="truncate block text-sm">{tx.description || "-"}</span>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {tx.account.name}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {tx.toAccount ? tx.toAccount.name : "-"}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${isIncome ? "text-emerald-600" : isTransfer ? "text-blue-600" : "text-rose-600"}`}>
                          {isIncome ? "+" : isTransfer ? "" : "-"}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.receiptUrl && (
                            <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" title="Lihat Foto Bukti">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </Button>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TransactionModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        accounts={initialAccounts} 
        currentUserId={currentUserId}
      />
    </div>
  );
}
