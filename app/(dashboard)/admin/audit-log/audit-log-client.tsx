"use client";

import { useState } from "react";
import { getActivityLogs } from "@/app/actions/audit-log";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollText, Search, FilterX, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatDateTime, getRoleLabel, cn } from "@/lib/utils";
import { toast } from "sonner";

interface ActivityLogRow {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Props {
  initial: { logs: ActivityLogRow[]; total: number; page: number; pageSize: number; timezone: string };
  options: { users: { id: string; name: string; role: string }[]; entityTypes: string[]; actions: string[] };
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  STATUS_CHANGE: "Ubah Status",
  LOGIN: "Login",
  LOGIN_FAILED: "Login Gagal",
  LOGOUT: "Logout",
  VERIFY: "Verifikasi",
  UNVERIFY: "Batal Verifikasi",
  PIN_RESET: "Reset PIN",
  PIN_CHANGE: "Ganti PIN",
  ROLE_CHANGE: "Ganti Role",
  SETTING_CHANGE: "Ubah Pengaturan",
  IMPORT: "Import",
};

function actionClass(action: string) {
  switch (action) {
    case "DELETE":
    case "LOGIN_FAILED":
    case "UNVERIFY":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "CREATE":
    case "VERIFY":
    case "LOGIN":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "PIN_RESET":
    case "ROLE_CHANGE":
    case "SETTING_CHANGE":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    default:
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditLogClient({ initial, options }: Props) {
  const [logs, setLogs] = useState<ActivityLogRow[]>(initial.logs);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [isLoading, setIsLoading] = useState(false);
  const [detail, setDetail] = useState<ActivityLogRow | null>(null);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    actorId: "all",
    entityType: "all",
    action: "all",
    entityId: "",
  });

  const timezone = initial.timezone;
  const pageSize = initial.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(targetPage: number, activeFilters = filters) {
    setIsLoading(true);
    try {
      const res = await getActivityLogs({ ...activeFilters, page: targetPage });
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setTotal(res.data.total);
        setPage(res.data.page);
      } else {
        toast.error(res.error || "Gagal memuat log aktivitas");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setIsLoading(false);
    }
  }

  function resetFilters() {
    const empty = { from: "", to: "", actorId: "all", entityType: "all", action: "all", entityId: "" };
    setFilters(empty);
    load(1, empty);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-primary" />
          Log Aktivitas
        </h1>
        <p className="text-muted-foreground font-medium">
          Jejak siapa mengubah apa dan kapan. Log bersifat permanen dan tidak bisa diubah atau dihapus.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dari Tanggal</label>
              <Input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sampai Tanggal</label>
              <Input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pengguna</label>
              <Select value={filters.actorId} onValueChange={(v) => setFilters((p) => ({ ...p, actorId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pengguna</SelectItem>
                  {options.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({getRoleLabel(u.role)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entitas</label>
              <Select value={filters.entityType} onValueChange={(v) => setFilters((p) => ({ ...p, entityType: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Entitas</SelectItem>
                  {options.entityTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aksi</label>
              <Select value={filters.action} onValueChange={(v) => setFilters((p) => ({ ...p, action: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  {options.actions.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ID Data</label>
              <Input
                placeholder="Opsional"
                value={filters.entityId}
                onChange={(e) => setFilters((p) => ({ ...p, entityId: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={resetFilters} disabled={isLoading}>
              <FilterX className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button onClick={() => load(1)} disabled={isLoading}>
              <Search className="h-4 w-4 mr-2" /> {isLoading ? "Memuat..." : "Terapkan Filter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                  <TableHead className="min-w-64">Keterangan</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Belum ada log aktivitas untuk filter ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs font-medium">
                        {formatDateTime(log.createdAt, timezone)}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{log.actorName || "Anonim / Sistem"}</div>
                        {log.actorRole && (
                          <div className="text-xs text-muted-foreground">{getRoleLabel(log.actorRole)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("whitespace-nowrap", actionClass(log.action))}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{log.entityType}</TableCell>
                      <TableCell className="text-sm">
                        {log.summary || "-"}
                        {log.reason && (
                          <div className="text-xs text-muted-foreground mt-0.5">Alasan: {log.reason}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-4 text-sm">
            <span className="text-muted-foreground">
              {total} log · Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={isLoading || page <= 1} onClick={() => load(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={isLoading || page >= totalPages} onClick={() => load(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_LABELS[detail.action] || detail.action} · {detail.entityType}</DialogTitle>
                <DialogDescription>
                  {formatDateTime(detail.createdAt, timezone)} oleh {detail.actorName || "Anonim / Sistem"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><span className="text-muted-foreground">ID Data:</span> <span className="font-mono text-xs break-all">{detail.entityId || "-"}</span></div>
                  <div><span className="text-muted-foreground">IP:</span> {detail.ip || "-"}</div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Perangkat:</span> <span className="text-xs break-all">{detail.userAgent || "-"}</span></div>
                  {detail.summary && <div className="sm:col-span-2"><span className="text-muted-foreground">Keterangan:</span> {detail.summary}</div>}
                  {detail.reason && <div className="sm:col-span-2"><span className="text-muted-foreground">Alasan:</span> {detail.reason}</div>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <JsonBlock title="Sebelum" value={detail.before} />
                  <JsonBlock title="Sesudah" value={detail.after} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
