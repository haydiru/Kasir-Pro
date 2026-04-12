"use client";

import { useState } from "react";
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
import {
  users as initialUsers,
  stores,
  getRoleBadgeVariant,
  getRoleLabel,
  type User,
  type Role,
} from "@/lib/mock-data";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [userList] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStore, setFilterStore] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<Role>("cashier");
  const [formStore, setFormStore] = useState(stores[0].id);
  const [formCycleStart, setFormCycleStart] = useState("1");
  const [formCycleEnd, setFormCycleEnd] = useState("30");

  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    const matchesStore = filterStore === "all" || u.storeId === filterStore;
    return matchesSearch && matchesRole && matchesStore;
  });

  const openEditDialog = (user: User) => {
    setEditUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormStore(user.storeId);
    setFormCycleStart(String(user.payrollCycleStart));
    setFormCycleEnd(String(user.payrollCycleEnd));
  };

  const handleCreate = () => {
    toast.success("Pengguna berhasil ditambahkan", {
      description: `${formName} telah ditambahkan sebagai ${getRoleLabel(formRole)}.`,
    });
    setCreateDialogOpen(false);
    resetForm();
  };

  const handleEdit = () => {
    toast.success("Data pengguna diperbarui", {
      description: `Perubahan pada ${formName} telah disimpan.`,
    });
    setEditUser(null);
    resetForm();
  };

  const handleResetPin = (user: User) => {
    toast.success("PIN berhasil direset", {
      description: `PIN ${user.name} telah direset ke default.`,
    });
  };

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("cashier");
    setFormStore(stores[0].id);
    setFormCycleStart("1");
    setFormCycleEnd("30");
  };

  const roleOptions: Role[] = ["super_admin", "admin", "cashier", "pramuniaga"];

  const UserFormContent = () => (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="form-name">Nama Lengkap</Label>
          <Input
            id="form-name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Nama pegawai..."
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="form-email">Email</Label>
          <Input
            id="form-email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="email@minimart.id"
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={formRole} onValueChange={(v) => setFormRole(v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  {getRoleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Toko</Label>
          <Select value={formStore} onValueChange={setFormStore}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name.split(" - ")[1] || store.name}
                </SelectItem>
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
            <Input
              id="cycle-start"
              type="number"
              min={1}
              max={31}
              value={formCycleStart}
              onChange={(e) => setFormCycleStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycle-end" className="text-xs">Tanggal Akhir</Label>
            <Input
              id="cycle-end"
              type="number"
              min={1}
              max={31}
              value={formCycleEnd}
              onChange={(e) => setFormCycleEnd(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-base font-semibold">Daftar Pengguna</h2>
          <p className="text-sm text-muted-foreground">
            {userList.length} pengguna terdaftar di semua cabang
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
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
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Semua toko" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Toko</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name.split(" - ")[1] || store.name}
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
                <TableHead>Toko</TableHead>
                <TableHead>Siklus Gaji</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Tidak ada pengguna yang sesuai filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const store = stores.find((s) => s.id === user.storeId);
                  return (
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
                        <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {store?.name?.split(" - ")[1] || store?.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        Tgl {user.payrollCycleStart} — {user.payrollCycleEnd}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
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
                  );
                })
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
              Isi data pegawai untuk membuat akun baru
            </DialogDescription>
          </DialogHeader>
          <UserFormContent />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={!formName || !formEmail}>
              Simpan
            </Button>
          </div>
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
          <UserFormContent />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditUser(null)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleEdit}>
              Simpan Perubahan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
