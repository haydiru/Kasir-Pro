"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Search,
  Printer,
  MessageSquare,
  FileEdit,
  Trash2,
} from "lucide-react";
import { 
  formatCurrency, 
  formatDateTime, 
  getRoleLabel, 
  getStatusColor,
  calcExpectedCash,
  getExpenditureTotal,
  cn
} from "@/lib/utils";
import Link from "next/link";
import { deleteShiftReport } from "@/app/actions/report";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface HistoryClientProps {
  initialReports: any[];
  userRole?: string;
}

export function HistoryClient({ initialReports, userRole }: HistoryClientProps) {
  const [searchDate, setSearchDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: session } = useSession();
  const router = useRouter();

  const isAdmin = userRole === "admin" || userRole === "super_admin" || session?.user?.role === "admin" || session?.user?.role === "super_admin";

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus laporan ini secara permanen?")) return;
    
    setIsDeleting(id);
    try {
      const res = await deleteShiftReport(id);
      if (res.success) {
        toast.success("Laporan berhasil dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus laporan");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan teknis");
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredReports = initialReports.filter((r) => {
    const reportDateStr = r.date.toISOString().split("T")[0];
    const matchesDate = !searchDate || reportDateStr === searchDate;
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    return matchesDate && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Toko</TableHead>
                <TableHead className="text-right">POS Tunai</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Tidak ada laporan yang sesuai filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => {
                  const expected = calcExpectedCash(report);
                  const diff = report.manualCashCount - expected;

                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {report.date.toISOString().split("T")[0]}
                      </TableCell>
                      <TableCell>{report.user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {report.shiftType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {report.store.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(report.posCash)}
                      </TableCell>
                      <TableCell className="text-right">
                        {report.status === "Draft" ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          <span
                            className={
                              diff < 0
                                ? "text-destructive font-medium"
                                : diff > 0
                                ? "text-emerald-600 font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {diff >= 0 ? "+" : ""}
                            {formatCurrency(diff)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${getStatusColor(report.status)}`}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedReport(report)}
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Edit Laporan"
                            disabled={report.status === "Verified"}
                          >
                            <Link href={`/cashier/report?id=${report.id}`}>
                              <FileEdit className={cn("h-4 w-4 text-muted-foreground", report.status === "Verified" && "opacity-20")} />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Print Bukti"
                          >
                            <Link href={`/cashier/report/${report.id}/print`}>
                              <Printer className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(report.id)}
                              disabled={isDeleting === report.id}
                              title="Hapus Laporan"
                            >
                              <Trash2 className={`h-4 w-4 ${isDeleting === report.id ? "animate-pulse" : ""}`} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Laporan Shift</DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6 pt-4">
               {/* Summary Info */}
               <div className="grid grid-cols-2 gap-4 text-sm">
                 <div>
                   <p className="text-muted-foreground">Kasir</p>
                   <p className="font-semibold">{selectedReport.user.name}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-muted-foreground">Toko</p>
                   <p className="font-semibold">{selectedReport.store.name}</p>
                 </div>
                 <div>
                   <p className="text-muted-foreground">Tanggal & Waktu</p>
                   <p className="font-medium">
                      {selectedReport.date.toISOString().split("T")[0]}
                   </p>
                 </div>
                 <div className="text-right">
                   <p className="text-muted-foreground">Status</p>
                   <Badge className={`mt-1 ${getStatusColor(selectedReport.status)}`}>
                     {selectedReport.status}
                   </Badge>
                 </div>
               </div>

               <Separator />

               {/* Financial Data */}
               <div className="space-y-3">
                 <h4 className="font-semibold text-sm">Data Keuangan</h4>
                 <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="text-muted-foreground">Modal Awal Laci</div>
                    <div className="text-right font-mono font-medium">{formatCurrency(selectedReport.startingCash)}</div>
                    
                    <div className="text-muted-foreground">POS Tunai</div>
                    <div className="text-right font-mono font-medium">{formatCurrency(selectedReport.posCash)}</div>
                    
                    <div className="text-muted-foreground">Uang Tagihan Tambahan</div>
                    <div className="text-right font-mono font-medium">{formatCurrency(selectedReport.billMoneyReceived)}</div>

                    <div className="text-muted-foreground">Cash Manual Hitungan Kasir</div>
                    <div className="text-right font-mono font-bold mt-2 pt-2 border-t border-dashed">
                      {formatCurrency(selectedReport.manualCashCount)}
                    </div>
                 </div>
               </div>

                {/* Cashier Revision Notes */}
                {selectedReport.cashierNote && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
                     <div className="flex items-center gap-2 text-blue-700 font-medium">
                       <FileEdit className="h-4 w-4" />
                       <span className="text-sm">Catatan Revisi Kasir</span>
                     </div>
                     <p className="text-xs text-blue-800 whitespace-pre-wrap font-mono bg-blue-100/50 p-2 rounded">
                       {selectedReport.cashierNote}
                     </p>
                  </div>
                )}

               {/* Notes Details if verified */}
               {selectedReport.status === "Verified" && selectedReport.adminNotes && (
                 <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm">Catatan Verifikasi Admin</span>
                    </div>
                    <p className="text-sm text-amber-800 dark:text-amber-500">
                      {selectedReport.adminNotes}
                    </p>
                 </div>
               )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
