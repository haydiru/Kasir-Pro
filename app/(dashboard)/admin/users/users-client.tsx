"use client";

import { useState, useActionState, useEffect } from "react";
import { User } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Search,
  CalendarRange,
} from "lucide-react";
import { getRoleBadgeVariant, getRoleLabel } from "@/lib/utils";
import { type Role } from "@/lib/mock-data";
import { toast } from "sonner";
import { createStoreUser, updateStoreUser, resetUserPin } from "@/app/actions/admin";

interface UsersClientProps {
  initialUsers: User[];
  storeName: string;
}

export function UsersClient({ initialUsers, storeName }: UsersClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Form states
  const [createState, createAction, isCreating] = useActionState(createStoreUser, undefined);
  const [updateState, updateAction, isUpdating] = useActionState(updateStoreUser, undefined);

  useEffect(() => {
    if (createState === "SUCCESS") {
      toast.success("Pengguna berhasil ditambahkan", {
        description: `Pengguna telah didaftarkan ke toko ini.`,
      });
      setCreateDialogOpen(false);
    } else if (createState) {
      toast.error(createState);
    }
  }, [createState]);

  useEffect(() => {
    if (updateState === "SUCCESS") {
      toast.success("Data pengguna diperbarui");
      setEditUser(null);
    } else if (updateState) {
      toast.error(updateState);
    }
  }, [updateState]);

  const filteredUsers = initialUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleResetPin = async (user: User) => {
    const res = await resetUserPin(user.id);
    if (res.success) {
      toast.success("PIN berhasil direset", {
        description: `PIN ${user.name} telah direset ke default (123456).`,
      });
    } else {
      toast.error("Gagal", { description: res.message });
    }
  };

  const roleOptions: Role[] = ["super_admin", "admin", "cashier", "pramuniaga"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-base font-semibold">Daftar Pengguna</h2>
          <p className="text-sm text-muted-foreground">
            {initialUsers.length} pengguna terdaftar di toko {storeName}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Tambah Pengguna
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Semua role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Role</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Siklus Gaji</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Tidak ada pengguna yang sesuai filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role as Role)} className="text-xs">
                        {getRoleLabel(user.role as Role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      Tgl {user.payrollCycleStart || 1} — {user.payrollCycleEnd || 30}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(user)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPin(user)}>
                            <KeyRound className="mr-2 h-3.5 w-3.5" />
                            Reset PIN
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Tambah Pengguna Baru
            </DialogTitle>
            <DialogDescription>
              Isi data pegawai untuk membuat akun baru. PIN default adalah 123456.
            </DialogDescription>
          </DialogHeader>
          <form action={createAction} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="form-name">Nama Lengkap</Label>
                <Input id="form-name" name="name" required placeholder="Nama pegawai..." />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="form-email">Email</Label>
                <Input id="form-email" name="email" type="email" required placeholder="email@minimart.id" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Role</Label>
                <Select name="role" defaultValue="cashier">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payroll Cycle */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                Siklus Gaji
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cycle-start" className="text-xs">Tanggal Mulai</Label>
                  <Input id="cycle-start" name="cycleStart" type="number" min={1} max={31} required defaultValue="1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycle-end" className="text-xs">Tanggal Akhir</Label>
                  <Input id="cycle-end" name="cycleEnd" type="number" min={1} max={31} required defaultValue="30" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="flex-1" disabled={isCreating}>
                {isCreating ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Pengguna
            </DialogTitle>
            <DialogDescription>
              Perbarui data {editUser?.name}
            </DialogDescription>
          </DialogHeader>
          <form action={updateAction} className="space-y-4 pt-2">
            <input type="hidden" name="id" value={editUser?.id || ""} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-name">Nama Lengkap</Label>
                <Input id="edit-name" name="name" required defaultValue={editUser?.name || ""} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" name="email" type="email" required defaultValue={editUser?.email || ""} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Role</Label>
                <Select name="role" defaultValue={editUser?.role || "cashier"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payroll Cycle */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                Siklus Gaji
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-cycle-start" className="text-xs">Tanggal Mulai</Label>
                  <Input id="edit-cycle-start" name="cycleStart" type="number" min={1} max={31} required defaultValue={editUser?.payrollCycleStart || "1"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cycle-end" className="text-xs">Tanggal Akhir</Label>
                  <Input id="edit-cycle-end" name="cycleEnd" type="number" min={1} max={31} required defaultValue={editUser?.payrollCycleEnd || "30"} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditUser(null)}>Batal</Button>
              <Button type="submit" className="flex-1" disabled={isUpdating}>
                 {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
