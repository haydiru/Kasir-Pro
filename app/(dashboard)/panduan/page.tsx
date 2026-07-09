"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  ClipboardList,
  FileText,
  ShieldCheck,
  Wallet,
  Smartphone,
  Users,
  Settings,
  LogIn,
  LogOut,
  PlusCircle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileEdit,
  ArrowRightLeft,
  ListCollapse,
  Undo,
  Package
} from "lucide-react";

export default function PanduanPage() {
  const [activeTab, setActiveTab] = useState("staff");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 md:p-8 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Pusat Panduan KasirPro
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Panduan lengkap alur kerja toko untuk Staf Toko (Kasir & Pramuniaga) dan Administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="staff" className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            Umum & Staf Toko
          </TabsTrigger>
          <TabsTrigger value="admin" className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Khusus Administrator
          </TabsTrigger>
        </TabsList>

        {/* ----------------- TAB: STAFF ----------------- */}
        <TabsContent value="staff" className="space-y-6 mt-6">
          {/* Alur Akses dan Login */}
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <LogIn className="h-5 w-5" />
                1. Akses Masuk (Login) & PIN Pengguna
              </CardTitle>
              <CardDescription>Tahap awal memulai akses ke dalam sistem KasirPro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-blue-200 text-blue-600 bg-blue-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Gunakan Email & PIN Terdaftar</p>
                  <p>Masukkan alamat email Anda yang telah didaftarkan oleh Administrator dan gunakan PIN default <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-bold">123456</code>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-blue-200 text-blue-600 bg-blue-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Ganti PIN Default Segera</p>
                  <p>Setelah masuk, klik ikon kunci (<code className="text-foreground">Ganti PIN</code>) di pojok kiri bawah menu sidebar untuk mengganti PIN default Anda dengan PIN 6 angka rahasia Anda sendiri demi alasan keamanan.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alur Absensi */}
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Clock className="h-5 w-5" />
                2. Presensi Kerja (Clock-In & Clock-Out)
              </CardTitle>
              <CardDescription>Setiap staf wajib melakukan presensi di awal dan akhir shift kerja.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Masuk ke Menu Presensi</p>
                  <p>Pilih menu <strong className="text-foreground">Presensi</strong> di sidebar.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Pilih Shift & Peran Kasir</p>
                  <p>Tentukan shift kerja Anda (<strong className="text-foreground">Pagi</strong> atau <strong className="text-foreground">Malam</strong>).</p>
                  <p className="text-amber-600 dark:text-amber-400 font-medium mt-1">
                    ⚠️ PENTING: Jika Anda bertugas menjaga laci uang/melayani pembayaran kasir pada shift ini, pastikan centang opsi &quot;Login/Bertindak sebagai Kasir&quot;. Jika Anda hanya pramuniaga umum, biarkan tidak dicentang.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Mulai Shift (Clock-In)</p>
                  <p>Klik tombol hijau <strong className="text-foreground">Clock-In</strong>. Waktu mulai kerja Anda akan berjalan secara real-time.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">4</Badge>
                <div>
                  <p className="font-semibold text-foreground">Selesai Shift (Clock-Out)</p>
                  <p>Sebelum pulang, kembali ke menu Presensi dan klik tombol merah <strong className="text-foreground">Clock-Out</strong> agar jam kerja Anda terekam dengan benar untuk perhitungan gaji.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alur Pramuniaga */}
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <FileEdit className="h-5 w-5" />
                3. Alur Kerja Pramuniaga (Entri Data Shift)
              </CardTitle>
              <CardDescription>Pramuniaga mencatat aktivitas layanan digital dan pengeluaran selama shift berlangsung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>Meskipun Anda bukan kasir utama yang memegang laci uang, Anda dapat membantu mencatat transaksi melalui menu <strong className="text-foreground">Entri Data</strong> di bawah bagian Pramuniaga:</p>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Catat Layanan Digital & Top Up</p>
                  <p>Masukkan transaksi Top Up E-Wallet, Transfer Bank, Listrik, atau PDAM yang Anda layani secara tunai/non-tunai. Tuliskan Modal, Laba, dan ID Flip sebagai bukti transaksi.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Catat Pengeluaran Tambahan</p>
                  <p>Bila Anda disuruh membeli perlengkapan toko atau membayar sesuatu, catat pengeluaran tersebut dan pilih sumber dana yang digunakan (misal: diambil dari laci kasir, dibayar dari uang tagihan supplier, atau transfer bank).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Lakukan Sinkronisasi Data</p>
                  <p>Klik tombol <strong className="text-foreground">Sinkronkan Data</strong>. Semua entri Anda akan otomatis digabungkan ke Laporan Shift Kasir utama secara real-time.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alur Kasir */}
          <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <ClipboardList className="h-5 w-5" />
                4. Alur Kerja Kasir (Tutup Shift & Hitung Uang)
              </CardTitle>
              <CardDescription>Alur krusial bagi pemegang laci kasir untuk merangkum keuangan di akhir shift.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Buka Menu Laporan Shift</p>
                  <p>Akses menu <strong className="text-foreground">Laporan Shift</strong> di sidebar. Data transaksi digital dan pengeluaran yang diinput oleh rekan Pramuniaga Anda akan otomatis tampil di sini.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Input Data dari Aplikasi POS Toko</p>
                  <p>Isi kolom <strong className="text-foreground">POS Cash</strong> (total penjualan tunai pada sistem POS) dan <strong className="text-foreground">POS Debit</strong> (total penjualan debit pada EDC).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Periksa Pendapatan Tagihan Masuk</p>
                  <p>Jika ada titipan uang dari kurir/supplier masuk, isikan di kolom <strong className="text-foreground">Uang Tagihan Masuk</strong>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">4</Badge>
                <div>
                  <p className="font-semibold text-foreground">Hitung Uang Fisik Secara Manual</p>
                  <p>Keluarkan semua uang kertas & koin di laci kasir, hitung dengan teliti, lalu masukkan hasilnya pada kolom <strong className="text-foreground">Uang Fisik Laci (Manual Count)</strong>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">5</Badge>
                <div>
                  <p className="font-semibold text-foreground">Periksa Selisih (Discrepancy)</p>
                  <p>Sistem akan otomatis menghitung selisih antara uang fisik laci dengan uang seharusnya (<code className="text-foreground">Modal Awal + POS Cash + Layanan Digital Tunai - Pengeluaran Kasir</code>).</p>
                  <p className="text-xs bg-muted p-2 rounded-md font-mono mt-1 text-foreground">
                    Rumus Uang Seharusnya = Modal Awal + POS Cash + Digital Tunai - Pengeluaran Laci
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-indigo-200 text-indigo-600 bg-indigo-50">6</Badge>
                <div>
                  <p className="font-semibold text-foreground">Kirim Laporan (Submit)</p>
                  <p>Jika semua data sudah benar, berikan catatan kasir jika perlu, lalu klik <strong className="text-foreground">Kirim Laporan</strong>. Status laporan akan berubah menjadi <strong className="text-amber-500">Submitted</strong> menunggu verifikasi Admin.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alur Barang Kosong */}
          <Card className="border-0 shadow-sm border-l-4 border-l-rose-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <ClipboardList className="h-5 w-5" />
                5. Manajemen Barang Kosong (Out-of-Stock)
              </CardTitle>
              <CardDescription>Semua staf dapat mendaftarkan produk rak yang habis untuk segera diadakan kembali.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-rose-200 text-rose-600 bg-rose-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Laporkan Barang Habis</p>
                  <p>Masuk ke menu <strong className="text-foreground">Barang Kosong</strong>, klik <strong className="text-foreground">Tambah Barang Kosong</strong>, lalu masukkan nama produk dan catatan tambahan (misal: ukuran, merk, atau rasa yang habis).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-rose-200 text-rose-600 bg-rose-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Status Permintaan</p>
                  <p>Barang yang baru dilaporkan akan berstatus <strong className="text-rose-500">BUTUH</strong>. Ketika barang sedang dibeli oleh admin/staf, ubah status menjadi <strong className="text-blue-500">PROSES</strong>. Setelah barang sampai di toko, ubah status ke <strong className="text-emerald-500">SELESAI</strong>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-rose-200 text-rose-600 bg-rose-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Gunakan Link Publik untuk Kurir/Sales</p>
                  <p>Administrator dapat membagikan link publik Barang Kosong kepada sales supplier atau kurir pengantar barang agar mereka mengetahui produk apa saja yang kosong di toko secara real-time tanpa perlu masuk ke dalam aplikasi.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alur Tagihan Supplier */}
          <Card className="border-0 shadow-sm border-l-4 border-l-violet-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <FileText className="h-5 w-5" />
                6. Tagihan Supplier & Invoice
              </CardTitle>
              <CardDescription>Memantau dan menyelesaikan tagihan dari sales supplier yang jatuh tempo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Pantau Batas Waktu (Due Date)</p>
                  <p>Buka menu <strong className="text-foreground">Tagihan Supplier</strong>. Setiap invoice tercatat memiliki tanggal jatuh tempo. Tagihan yang mendekati tanggal jatuh tempo akan ditandai dengan warna peringatan merah.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Pencocokan Barang Retur Sebelum Pembayaran</p>
                  <p>Sebelum melakukan pembayaran tagihan, periksa apakah terdapat peringatan <strong className="text-amber-600">Ada Barang Retur</strong> pada kartu tagihan supplier tersebut. Karyawan wajib menuntaskan/memotong nilai retur ini sebelum menyerahkan uang pembayaran ke supplier.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Lunasi Tagihan & Alokasi Dana (Split Payment)</p>
                  <p>Setelah retur (jika ada) diselesaikan, klik tombol <strong className="text-emerald-600">Tandai Lunas</strong>. Sistem akan memunculkan formulir alokasi pembayaran untuk membagi total tagihan dari kombinasi sumber dana:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                    <li><strong className="text-foreground">Uang Laci Kasir (Cash)</strong> — Pembayaran tunai dari laci kasir saat shift berjalan.</li>
                    <li><strong className="text-foreground">Uang Titipan Tagihan (Bill Money)</strong> — Pembayaran menggunakan kas titipan khusus tagihan supplier.</li>
                    <li><strong className="text-foreground">Transfer Bank Rekening Toko</strong> — Pembayaran langsung ditransfer dari rekening bank toko.</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-1">Anda dapat mengisi sisa/seluruh tagihan pada salah satu sumber dana secara instan dengan mengklik tombol <strong className="text-primary">Isi Sisa</strong> di samping masing-masing baris input.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">4</Badge>
                <div>
                  <p className="font-semibold text-foreground">Sinkronisasi Otomatis ke Laporan Shift</p>
                  <p>Setelah alokasi dikonfirmasi, data pengeluaran tagihan akan <strong className="text-foreground">otomatis tercatat di laporan shift aktif</strong> dengan struktur rincian yang sama persis (terbagi berdasarkan Uang Laci, Uang Titipan, dan Transfer Bank). Tidak perlu lagi mencatat ulang secara manual di halaman Laporan Shift.</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    ✅ Jika status tagihan dikembalikan menjadi belum lunas, draf pengeluaran terkait di laporan shift akan otomatis dibersihkan tanpa meninggalkan data ganda.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">5</Badge>
                <div>
                  <p className="font-semibold text-foreground">Sinkronisasi Google Calendar</p>
                  <p>Setiap tagihan yang Anda catat, ubah statusnya, atau hapus akan otomatis diselaraskan dengan Google Calendar dari akun Google (email) yang ditautkan oleh toko (ditandai dengan badge <strong className="text-blue-500">Google Calendar Sinkron</strong>). Pengingat jatuh tempo akan muncul sebagai kegiatan seharian penuh (all-day event) di kalender Gmail toko.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alur Barang Retur */}
          <Card className="border-0 shadow-sm border-l-4 border-l-rose-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Undo className="h-5 w-5" />
                7. Pencatatan Barang Retur
              </CardTitle>
              <CardDescription>Mencatat barang cacat, rusak, atau kedaluwarsa yang akan dikembalikan ke supplier.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-rose-200 text-rose-600 bg-rose-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Catat Barang Rusak / Expired</p>
                  <p>Buka menu <strong className="text-foreground">Barang Retur</strong> di sidebar. Klik <strong className="text-foreground">Catat Retur Baru</strong>, lalu pilih supplier, ketik nama produk, jumlah barang, serta alasan retur.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-rose-200 text-rose-600 bg-rose-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Pantau & Perbarui Status Retur</p>
                  <p>Status awal barang retur adalah <strong className="text-rose-600">Pending / Di Toko</strong>. Klik <strong className="text-foreground">Tandai Dikirim Ke Supplier</strong> jika barang sudah dibawa oleh sales. Ketika retur sudah diganti dengan barang baru atau dipotong dari nota tagihan, tandai status sebagai <strong className="text-emerald-600">Selesai (Clear)</strong>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-rose-200 text-rose-600 bg-rose-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Integrasi Otomatis dengan Tagihan</p>
                  <p>Setiap barang retur berstatus Pending atau Dikirim akan otomatis muncul sebagai peringatan berwarna oranye pada kartu <strong className="text-foreground">Tagihan Supplier</strong> yang bersangkutan untuk mengingatkan kasir/pegawai sebelum melunasi tagihan.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- TAB: ADMIN ----------------- */}
        <TabsContent value="admin" className="space-y-6 mt-6">
          {/* Konfigurasi Awal */}
          <Card className="border-0 shadow-sm border-l-4 border-l-violet-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-violet-700 dark:text-violet-300">
                <Settings className="h-5 w-5" />
                1. Pengaturan Toko & Registrasi Pengguna
              </CardTitle>
              <CardDescription>Langkah awal administrator saat menggunakan aplikasi KasirPro pertama kali.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Atur Jam Kerja Shift Toko</p>
                  <p>Buka menu <strong className="text-foreground">Pengaturan Toko</strong>. Tambahkan pengaturan shift kerja (seperti Shift Pagi, Shift Malam) beserta jam mulai, jam selesai, dan waktu checkout otomatis apabila karyawan lupa menekan tombol clock-out.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Daftarkan Karyawan (Staf Toko)</p>
                  <p>Buka menu <strong className="text-foreground">Pengguna</strong>. Klik <strong className="text-foreground">Tambah Pengguna</strong> untuk mendaftarkan Admin, Kasir, atau Pramuniaga. Tentukan tanggal Siklus Gaji bulanan mereka (misal: tanggal 25 s.d. 24, atau tanggal 6 s.d. 5). Pengguna baru akan login dengan PIN default <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-bold">123456</code>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-violet-200 text-violet-600 bg-violet-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Integrasikan API Flip & Google Drive</p>
                  <p>Jika menggunakan rekening bank otomatis untuk mendeteksi setoran digital e-wallet, masukkan API Key Flip Anda pada menu Pengaturan Toko. Anda juga dapat menghubungkan Google Drive untuk menyimpan bukti foto nota secara cloud.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verifikasi Laporan */}
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <ShieldCheck className="h-5 w-5" />
                2. Verifikasi Laporan Shift & Pencocokan Flip
              </CardTitle>
              <CardDescription>Memastikan seluruh perhitungan laci uang kasir telah sesuai di akhir hari.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Tinjau Laporan Menunggu Verifikasi</p>
                  <p>Masuk ke menu <strong className="text-foreground">Verifikasi</strong>. Anda akan melihat daftar laporan shift kasir berstatus <strong className="text-amber-500">Submitted</strong>. Klik tombol <strong className="text-foreground">Verifikasi</strong>.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Periksa Perbedaan & Riwayat Rekening</p>
                  <p>Bandingkan uang fisik laci kasir dengan perhitungan sistem. Di bagian bawah dialog, sistem akan menampilkan data mutasi mutakhir dari **Transaksi Flip** bank toko untuk dicocokkan dengan entri transfer digital kasir.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Isi Selisih Akhir & Berikan Catatan</p>
                  <p>Jika terdapat kekurangan atau kelebihan yang dapat dimaklumi (misal: salah input nominal belanja), isi kolom <strong className="text-foreground">Selisih Admin</strong> dan masukkan <strong className="text-foreground">Catatan Admin</strong> (staf kasir akan menerima notifikasi otomatis atas catatan ini).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-amber-200 text-amber-600 bg-amber-50">4</Badge>
                <div>
                  <p className="font-semibold text-foreground">Approve Laporan</p>
                  <p>Klik <strong className="text-foreground">Verifikasi & Approve</strong>. Status laporan akan menjadi <strong className="text-emerald-600">Verified</strong>.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buku Kas */}
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Wallet className="h-5 w-5" />
                3. Buku Kas & Rekening Toko
              </CardTitle>
              <CardDescription>Memantau saldo laci kasir dan mutasi bank secara akurat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">1</Badge>
                <div>
                  <p className="font-semibold text-foreground">Alur Otomatis Setoran Shift</p>
                  <p>Ketika Anda memverifikasi laporan shift kasir, sistem otomatis membuat jurnal transaksi uang masuk (<strong className="text-emerald-600">INCOME</strong>) berkategori <strong className="text-foreground">Setoran Shift</strong> pada dompet <strong className="text-foreground">Kas Pegangan Personal</strong> Anda selaku Admin pemverifikasi. Saldo dompet Anda akan bertambah sebesar uang fisik yang diserahkan kasir.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">2</Badge>
                <div>
                  <p className="font-semibold text-foreground">Catat Pengeluaran Operasional</p>
                  <p>Jika Anda membelanjakan uang dari kas pegangan untuk belanja toko atau membayar tagihan supplier secara langsung, gunakan tombol <strong className="text-foreground">Catat Transaksi Baru</strong>, pilih kategori <strong className="text-foreground">EXPENSE</strong>, pilih dompet asal, dan masukkan bukti fotonya.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-emerald-200 text-emerald-600 bg-emerald-50">3</Badge>
                <div>
                  <p className="font-semibold text-foreground">Pindah Saldo Ke Bank Toko (Setoran Bank)</p>
                  <p>Ketika Anda menyetor uang tunai kas pegangan Anda ke bank toko, catat mutasi ini dengan memilih tipe transaksi <strong className="text-foreground">TRANSFER</strong>. Masukkan nominal uang yang disetor dari dompet <strong className="text-foreground">Kas Pegangan</strong> ke <strong className="text-foreground">Rekening Bank Toko (Rekening Bersama)</strong>.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
