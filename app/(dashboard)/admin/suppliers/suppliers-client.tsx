"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Search,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  MapPin,
  Phone,
  Building
} from "lucide-react";
import { toast } from "sonner";
import * as xlsx from "xlsx";

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  kota: string | null;
  provinsi: string | null;
  negara: string | null;
  kodePos: string | null;
  telepon: string | null;
  fax: string | null;
  bank: string | null;
  acc: string | null;
  atasNama: string | null;
  kontak: string | null;
  email: string | null;
  keterangan: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialSuppliers: Supplier[];
  storeId: string;
}

export default function SuppliersClient({ initialSuppliers, storeId }: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form states
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kota, setKota] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [negara, setNegara] = useState("Indonesia");
  const [kodePos, setKodePos] = useState("");
  const [telepon, setTelepon] = useState("");
  const [fax, setFax] = useState("");
  const [bank, setBank] = useState("");
  const [acc, setAcc] = useState("");
  const [atasNama, setAtasNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [email, setEmail] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  
  // Excel File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Filter & Search
  const filteredSuppliers = useMemo(() => {
    return initialSuppliers.filter((s) => {
      const query = searchQuery.toLowerCase();
      return (
        s.nama.toLowerCase().includes(query) ||
        s.kode.toLowerCase().includes(query) ||
        (s.kota && s.kota.toLowerCase().includes(query))
      );
    });
  }, [initialSuppliers, searchQuery]);

  // Open Form for Adding
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setKode("");
    setNama("");
    setAlamat("");
    setKota("");
    setProvinsi("");
    setNegara("Indonesia");
    setKodePos("");
    setTelepon("");
    setFax("");
    setBank("");
    setAcc("");
    setAtasNama("");
    setKontak("");
    setEmail("");
    setKeterangan("");
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setKode(s.kode);
    setNama(s.nama);
    setAlamat(s.alamat || "");
    setKota(s.kota || "");
    setProvinsi(s.provinsi || "");
    setNegara(s.negara || "Indonesia");
    setKodePos(s.kodePos || "");
    setTelepon(s.telepon || "");
    setFax(s.fax || "");
    setBank(s.bank || "");
    setAcc(s.acc || "");
    setAtasNama(s.atasNama || "");
    setKontak(s.kontak || "");
    setEmail(s.email || "");
    setKeterangan(s.keterangan || "");
    setIsFormOpen(true);
  };

  // Form Submit Handler (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!kode.trim() || !nama.trim()) {
      toast.error("Kode dan Nama supplier wajib diisi");
      return;
    }

    setIsLoading(true);
    const payload = {
      kode,
      nama,
      alamat,
      kota,
      provinsi,
      negara,
      kodePos,
      telepon,
      fax,
      bank,
      acc,
      atasNama,
      kontak,
      email,
      keterangan,
    };

    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers";
      const method = editingSupplier ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan data supplier");
      } else {
        toast.success(
          editingSupplier ? "Supplier berhasil diperbarui" : "Supplier baru berhasil ditambahkan"
        );
        setIsFormOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi internet.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus supplier "${name}"? Seluruh data tagihan terkait akan kehilangan referensi supplier.`)) return;

    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Supplier berhasil dihapus");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus supplier");
      }
    } catch {
      toast.error("Gagal melakukan aksi hapus.");
    }
  };

  // Download template Excel
  const handleDownloadTemplate = () => {
    const headers = [
      "KODE",
      "NAMA",
      "ALAMAT",
      "KOTA",
      "PROVINSI",
      "NEGARA",
      "KODEPOS",
      "TELEPON",
      "FAX",
      "BANK",
      "ACC",
      "ATASNAMA",
      "KONTAK",
      "EMAIL",
      "KETERANGAN",
    ];
    const sampleData = [
      [
        "SUPP-001",
        "Indofood Sukses Makmur",
        "Jl. Sudirman No 10",
        "Jakarta",
        "DKI Jakarta",
        "Indonesia",
        "12345",
        "021-123456",
        "021-654321",
        "BCA",
        "1234567890",
        "PT Indofood",
        "Budi PIC",
        "budi@indofood.com",
        "Distributor Utama Mie Instan",
      ],
    ];

    const worksheet = xlsx.utils.aoa_to_sheet([headers, ...sampleData]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Template Supplier");
    xlsx.writeFile(workbook, "Template_Import_Supplier.xlsx");
    toast.success("Template Excel berhasil didownload!");
  };

  // Excel Import Handler
  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Pilih berkas Excel terlebih dahulu");
      return;
    }

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/suppliers/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal mengimport data");
      } else {
        const summary = data.summary;
        toast.success(
          `Import selesai! Dimasukkan: ${summary.inserted}, Diperbarui: ${summary.updated}, Dilewati: ${summary.skipped}`
        );
        setIsImportOpen(false);
        setSelectedFile(null);
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan teknis saat import file.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Master Supplier
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola data master supplier, hubungkan dengan pencatatan tagihan toko, dan import massal via Excel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="rounded-xl font-bold gap-2 py-5.5 px-4"
          >
            <Upload className="h-4.5 w-4.5" />
            Import Excel
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="rounded-xl font-bold gap-2 py-5.5 px-5 shadow-lg shadow-primary/10"
          >
            <Plus className="h-4.5 w-4.5" />
            Tambah Supplier
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari berdasarkan nama, kode, atau kota..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 rounded-xl bg-card border-muted-foreground/10 text-sm"
        />
      </div>

      {/* Supplier Grid/Table */}
      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-20 px-4 bg-muted/20 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-bold">
            {searchQuery ? "Supplier tidak ditemukan" : "Master data supplier kosong"}
          </p>
          <p className="text-xs max-w-xs">
            {searchQuery
              ? "Coba cari dengan kata kunci lain."
              : "Unggah daftar supplier menggunakan tombol Import Excel di atas atau tambahkan satu per satu."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase border border-border">
                        {supplier.kode}
                      </span>
                    </div>
                    <CardTitle className="text-base font-black tracking-tight pt-1">
                      {supplier.nama}
                    </CardTitle>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(supplier)}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(supplier.id, supplier.nama)}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 pb-4 text-xs font-semibold text-muted-foreground">
                <div className="grid grid-cols-2 gap-2 border-t border-dashed border-border/80 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span>{supplier.telepon || "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground/60 text-ellipsis overflow-hidden whitespace-nowrap" />
                    <span>{supplier.kota || "-"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded-lg border border-border/40">
                  <Building className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="font-mono text-[11px] truncate">
                    {supplier.bank ? `${supplier.bank}: ${supplier.acc || "-"}` : "Rekening Bank Kosong"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Excel Import */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import Supplier via Excel
            </DialogTitle>
            <DialogDescription className="text-xs">
              Unggah file Excel Anda (format `.xlsx` atau `.xls`). Kolom A sampai O harus berurutan. Kode dan Nama supplier wajib diisi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportExcel} className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Pilih File Excel</Label>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleDownloadTemplate}
                  className="text-xs font-bold text-primary h-auto p-0 flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Template
                </Button>
              </div>

              <div className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center hover:bg-accent/10 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-xs font-bold text-foreground">
                  {selectedFile ? selectedFile.name : "Klik untuk memilih berkas Excel"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Maksimal file size 5MB
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsImportOpen(false);
                  setSelectedFile(null);
                }}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isImporting || !selectedFile}
                className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                Mulai Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit Supplier */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">
              {editingSupplier ? "Edit Supplier" : "Tambah Supplier Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan informasi detail mengenai supplier untuk didaftarkan ke toko.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kode Supplier */}
              <div className="space-y-1.5">
                <Label htmlFor="kode" className="text-xs font-bold">
                  Kode Supplier <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="kode"
                  placeholder="Contoh: SUP-001"
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  required
                  disabled={!!editingSupplier} // Kode unik tidak bisa diedit setelah dibuat
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Nama Supplier */}
              <div className="space-y-1.5">
                <Label htmlFor="nama" className="text-xs font-bold">
                  Nama Supplier / Perusahaan <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="nama"
                  placeholder="Contoh: PT. Indofood Sukses Makmur"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Telepon */}
              <div className="space-y-1.5">
                <Label htmlFor="telepon" className="text-xs font-bold">Telepon</Label>
                <Input
                  id="telepon"
                  placeholder="Contoh: 0812345678"
                  value={telepon}
                  onChange={(e) => setTelepon(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Contoh: sales@indofood.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Kontak PIC */}
              <div className="space-y-1.5">
                <Label htmlFor="kontak" className="text-xs font-bold">Kontak Person (PIC)</Label>
                <Input
                  id="kontak"
                  placeholder="Contoh: Budi (Marketing)"
                  value={kontak}
                  onChange={(e) => setKontak(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border pt-4">
              {/* Bank */}
              <div className="space-y-1.5">
                <Label htmlFor="bank" className="text-xs font-bold">Nama Bank</Label>
                <Input
                  id="bank"
                  placeholder="Contoh: BCA, Mandiri, BRI"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Account Number */}
              <div className="space-y-1.5">
                <Label htmlFor="acc" className="text-xs font-bold">Nomor Rekening</Label>
                <Input
                  id="acc"
                  placeholder="Contoh: 12345678"
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Atas Nama */}
              <div className="space-y-1.5">
                <Label htmlFor="atasNama" className="text-xs font-bold">Nama Pemilik Rekening</Label>
                <Input
                  id="atasNama"
                  placeholder="Contoh: PT Indofood Sukses"
                  value={atasNama}
                  onChange={(e) => setAtasNama(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border pt-4">
              <Label htmlFor="alamat" className="text-xs font-bold">Alamat Kantor/Gudang</Label>
              <Textarea
                id="alamat"
                placeholder="Jl. Pahlawan No. 45"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                className="rounded-xl bg-muted/30 min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Kota */}
              <div className="space-y-1.5">
                <Label htmlFor="kota" className="text-xs font-bold">Kota</Label>
                <Input
                  id="kota"
                  placeholder="Jakarta"
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Provinsi */}
              <div className="space-y-1.5">
                <Label htmlFor="provinsi" className="text-xs font-bold">Provinsi</Label>
                <Input
                  id="provinsi"
                  placeholder="DKI Jakarta"
                  value={provinsi}
                  onChange={(e) => setProvinsi(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Negara */}
              <div className="space-y-1.5">
                <Label htmlFor="negara" className="text-xs font-bold">Negara</Label>
                <Input
                  id="negara"
                  value={negara}
                  onChange={(e) => setNegara(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              {/* Kode Pos */}
              <div className="space-y-1.5">
                <Label htmlFor="kodePos" className="text-xs font-bold">Kode Pos</Label>
                <Input
                  id="kodePos"
                  placeholder="12345"
                  value={kodePos}
                  onChange={(e) => setKodePos(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            {/* Keterangan & Fax */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fax" className="text-xs font-bold">Nomor Fax</Label>
                <Input
                  id="fax"
                  placeholder="Contoh: 021-654321"
                  value={fax}
                  onChange={(e) => setFax(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="keterangan" className="text-xs font-bold">Keterangan Tambahan</Label>
                <Input
                  id="keterangan"
                  placeholder="Distributor mi instan, roti, margarin, dll."
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFormOpen(false)}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSupplier ? "Perbarui Supplier" : "Simpan Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
