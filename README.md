# 🛒 KasirPro — Minimarket Shift, Product & Financial Management System
**Production Live URL**: [kasir-pro-three.vercel.app](https://kasir-pro-three.vercel.app)

**KasirPro** adalah platform web modern kelas enterprise untuk manajemen operasional minimarket multi-cabang. Dibangun dengan fokus pada kecepatan, pencegahan selisih kas fisik laci kasir, audit kenaikan harga modal barang secara otomatis via Vision AI, rekonsiliasi transaksi digital Flip, serta pencatatan arus kas operasional toko.

---

## 🌟 Fitur Utama & Modul Sistem

### 1. 📊 Admin Dashboard & Smart Analytics (`/admin/dashboard`)
- **Kartu Real-Time Omzet Hari Ini**: Menampilkan omzet murni transaksi POS hari ini tanpa terdistorsi oleh filter rentang tanggal.
- **Financial Summary Cards**: Total Omzet Periode, Omzet Cash, Omzet Debit, Total Pengeluaran Operasional, Pendapatan Digital, dan Laba Digital.
- **Filter Rentang Tanggal Preset**: `Hari Ini`, `7 Hari`, `30 Hari`, `90 Hari`, `Tahun Ini`, dan `Semua (All Time)`.
- **Analisis Weekday vs Weekend**: Rasio Cash vs Debit, persentase *Weekend Surge %*, dan deteksi otomatis hari terramai.
- **Smart Recommendations Engine**: Deteksi kasir berkinerja tinggi, jawara laba digital, peluang upselling layanan digital, dan peringatan jika akurasi kasir < 80%.
- **Leaderboard Kasir**: Peringkat kasir berdasarkan Medali (🥇 🥈 🥉), Jumlah Shift, Total Omzet, % Debit, Laba Digital, dan Akurasi Kas Fisik.

### 2. 📦 Master Data Barang Toko (`/products`)
- **Katalog Inventaris Lengkap**: SKU/ID Barang (`itemCode`), Kode Barcode (`barcode`), Nama Barang (`name`), Jumlah Stok (`stock`), Harga Modal (`costPrice`), Harga Jual (`sellingPrice`), Satuan (`unit`), dan Kategori (`category`).
- **Import & Export Excel (`xlsx`)**: 
  - 1-klik unduh seluruh katalog toko dalam format file Excel rapi (`/api/products/export`).
  - Batch import Excel untuk tambah baru / update barang massal (`/api/products/import`) — **khusus Admin**, maks. 5 MB / 10.000 baris.
- **Hak Akses**: Tambah, edit, hapus, dan import barang hanya untuk Admin/Super Admin. Kasir & Pramuniaga dapat melihat katalog, export, dan memakai Scan Nota AI.
- **Audit Trail Riwayat Kenaikan Modal (`ProductPriceHistory`)**:
  - Menyimpan histori setiap perubahan harga modal & jual secara permanen (modal lama vs baru, selisih Rp & %, sumber: Excel / Nota AI / Manual, dan foto bukti), termasuk penurunan harga dari import Excel.
  - Modal interaktif timeline riwayat harga pada tiap produk.
  - Tombol konfirmasi cepat: `[Tandai Sudah Disesuaikan di Aplikasi Kasir]`.

### 3. 🤖 Ekstraksi Nota Belanja AI via OpenRouter (GPT Luna)
- **Vision AI Engine**: Memanfaatkan model `openai/gpt-6-luna` (fallback `~openai/gpt-luna-latest`) via OpenRouter API.
- **Ekstraksi Otomatis**: Membaca foto nota belanja supplier kasir, mengekstrak baris item, kuantitas, harga beli satuan, dan total belanja.
- **Algoritma 3-Tier Matcher**:
  1. *Tier 1*: Pencocokan persis Barcode.
  2. *Tier 2*: Pencocokan persis Nama Barang.
  3. *Tier 3*: Fuzzy similarity matching.
- **Alert Kenaikan Modal**: Otomatis mendeteksi kenaikan harga modal dan mencatat riwayat kenaikan.
- **Sakelar Kontrol Per Toko (`enableAiReceiptScan`)**: Default nonaktif di `/admin/store-settings`. Saat nonaktif, foto nota opsional. Saat aktif, foto nota wajib dan AI memproses ekstraksi di latar belakang.

### 4. 📑 Form Laporan Shift Kasir (`/cashier/report`, `/cashier/report/[id]/print`)
- **Seksi 1 (Info Shift & Modal)**: Auto-fill nama kasir, shift, tanggal, modal awal laci, dan Uang Tagihan Diterima (`billMoneyReceived`).
- **Seksi 2 (POS)**: Input Omzet POS Cash dan POS Debit.
- **Seksi 3 (Layanan Digital)**: Input mutasi Top Up E-Wallet, Pulsa, Token PLN dengan auto-match ID Flip dan penanda transaksi Non-Tunai.
- **Seksi 4 (Pengeluaran Toko)**: Input pengeluaran supplier dengan 3 sumber dana (Uang Tagihan, Uang Kasir, Transfer Bank) beserta kompresi upload foto nota.
- **Seksi 5 (Rekapitulasi Kas)**: Perhitungan real-time Kas Fisik Diharapkan vs Hitung Fisik Kasir, pemisahan Uang ke Verifikator (`toVerifierCash`) vs Setor Bank (`companyTransferAmount`).
- **Cetak Struk Thermal**: Format struk siap cetak ukuran 58mm / 80mm untuk arsip laci kasir.
- **Aturan Perubahan**: Kasir hanya dapat membuka & mengubah laporannya sendiri. Laporan `Submitted` hanya bisa diubah lewat alur revisi (tidak bisa kembali ke Draft), dan laporan `Verified` terkunci total. Entri pramuniaga hanya bisa diubah pembuatnya/pemilik laporan selama laporan masih Draft.

### 5. 🔍 Verifikasi Setoran Admin (`/admin/verifications`)
- Tampilan antrean laporan `Submitted` dengan split-view audit.
- Verifikasi nominal fisik aktual kasir, penguncian status laporan menjadi `Verified`, dan pembukuan otomatis ke Buku Kas.

### 6. ✉️ Transaksi Flip & Email Sync Webhook (`/admin/flip-transactions`, `/api/cron/sync-flip-gmail`)
- Sinkronisasi otomatis mutasi email `flip.id` via Gmail OAuth API.
- **Shift Window Filtering**: Peringatan transaksi dibatasi ketat pada jam operasional shift kasir (`getTZShiftRange`) dan anti-duplikasi antar shift.
- **Performa Tinggi**: Kueri dibatasi 3 hari terakhir dengan parallel chunking (8 email/chunk) dan client-side safety auto-timeout.

### 7. 📸 Presensi & Absensi Pegawai (`/attendance`, `/admin/attendance`)
- Clock-In / Clock-Out per shift (pegawai hanya bisa clock-out presensinya sendiri yang masih aktif).
- Monitoring live pegawai aktif bertugas dan rekap siklus penggajian bulanan (rekap gaji khusus Admin).

### 8. 💰 Buku Kas & Arus Kas Toko (`/admin/cashflow`)
- Buku Besar (Ledger) pemasukan vs pengeluaran operasional toko.
- Pemisahan pencatatan kas fisik verifikator dan setor tunai bank perusahaan.

### 9. 🧾 Tagihan Supplier & Google Calendar Sync (`/cashier/bills`)
- Pencatatan jatuh tempo invoice supplier dan nominal tagihan.
- Pelunasan wajib dialokasikan tepat sebesar nominal tagihan (Uang Kasir / Uang Tagihan / Transfer) ke laporan shift Draft.
- Pembatalan pelunasan ditolak jika pengeluaran sudah masuk laporan `Verified`; tagihan hanya bisa dihapus Admin atau pembuatnya selama belum lunas.
- Sinkronisasi event otomatis ke Google Calendar toko.

### 10. 💸 Kas Kecil Belanja Pegawai (`/shopping-funds`)
- Pencatatan serah terima dana kas kecil dan pelaporan belanja operasional beserta foto nota.
- Otoritas khusus Super Admin untuk koreksi/penghapusan data.

### 11. 📦 Barang Retur Supplier (`/retur`)
- Pencatatan barang cacat/rusak/expired per supplier.
- Tampilan ganda: Mode Tabel Padat (*Density View*) & Mode Kartu Grid (*Card View*).
- Aksi massal: Kirim Semua, Selesaikan Semua, Hapus Massal.

### 12. ⚠️ Barang Kosong & Share Publik Tim Gudang (`/empty-items`)
- Pencatatan barang habis di rak minimarket.
- Tautan publik tanpa login (`/share/empty-items/[storeId]`) untuk dibagikan ke tim gudang via WhatsApp. Perubahan status lewat tautan publik hanya berlaku untuk barang milik toko pada tautan tersebut.

### 13. 🔔 Pusat Notifikasi Real-Time (`/notifications`)
- Notifikasi terpusat untuk Admin dan Super Admin (kenaikan modal, selisih kas fisik, transaksi belum cocok).

### 14. 🛠️ Setelan Toko, Jam Shift & Manajemen User (`/admin/store-settings`, `/admin/users`, `/admin/suppliers`)
- Manajemen pengguna, role (`super_admin`, `admin`, `cashier`, `pramuniaga`), dan reset PIN.
- Hanya Super Admin yang dapat membuat, mengedit, atau mereset PIN akun Super Admin; toko tidak bisa kehilangan Super Admin terakhir.
- Setelan profil cabang, zona waktu (WIB/WITA/WIT, divalidasi), jam operasional shift, dan sakelar AI Scan.
- Integrasi Google (Calendar & Gmail Flip) hanya bisa dihubungkan/diputus oleh Admin.

### 15. 🛡️ Log Aktivitas / Audit Trail (`/admin/audit-log`)
- Mencatat **siapa** mengubah **apa**, **kapan**, beserta nilai **sebelum & sesudah** (tanpa PIN/hash/token).
- Aksi tercatat: login/logout/login gagal, tambah/ubah/hapus pengguna, ganti role, reset & ganti PIN, buat/simpan/kirim/revisi laporan shift (beserta diff entri), verifikasi & batal verifikasi, tagihan, buku kas, produk & import Excel, presensi, pengaturan toko/shift, integrasi Google & Flip, supplier.
- Disimpan di tabel `ActivityLog` yang **append-only**: trigger database menolak `UPDATE`, `DELETE`, dan `TRUNCATE`, dan RLS aktif sehingga tidak bisa dibaca lewat Supabase Data API.
- Filter: rentang tanggal, pengguna, entitas, aksi, dan ID data. Hanya Admin & Super Admin.

---

## 🔐 Keamanan

- **Otorisasi di server**: Setiap server action/API memeriksa sesi lewat helper `lib/auth-guard.ts` (`requireUser`, `requireAdmin`, `assertSameStore`). Role & `storeId` dibaca ulang dari database; JWT di-refresh dari database tiap 5 menit dan tidak bisa diubah dari browser.
- **Isolasi toko & kepemilikan**: Data diakses hanya bila milik toko pengguna (dan milik pengguna itu sendiri untuk laporan/presensi non-admin).
- **Data sensitif tidak dikirim ke browser**: hash PIN, token Google, dan pesan error mentah server.
- **Upload foto**: wajib login, maks. 10 MB, tipe file dicek dari isi file (JPG/PNG/WEBP/HEIC).
- **Google OAuth**: parameter `state` acak + cookie (anti-CSRF); akun Google selalu ditautkan ke toko milik admin yang login.
- **Cron**: `/api/cron/sync-flip-gmail` wajib header `Authorization: Bearer <CRON_SECRET>` dan menolak semua request jika `CRON_SECRET` tidak diset.

---

## 🛠️ Tech Stack & Dependencies

- **Frontend**: Next.js 16 (App Router + Turbopack), React 19, Tailwind CSS v4, Lucide React Icons.
- **Design System**: Upwork Modern Emerald Theme (`oklch(0.55 0.19 142)` / `#108a00` - `#16a34a`), hairline borders, rounded-2xl cards, status pill badges.
- **UI Components**: Radix UI / Shadcn UI (`Card`, `Badge`, `Button`, `Table`, `Dialog`, `Select`, `Input`, `Tabs`).
- **Data Visualization**: Recharts (`BarChart`, `LineChart`, `AreaChart`).
- **Backend & API**: Next.js Server Actions, NextAuth.js (Auth.js v5).
- **Database & ORM**: PostgreSQL (Supabase), Prisma ORM (v6).
- **Vision AI**: OpenRouter API (`openai/gpt-6-luna` / `~openai/gpt-luna-latest`).
- **File & Storage**: Supabase Storage bucket `receipts` (Foto Bukti & Struk Nota), fallback Base64 bila storage tidak tersedia.
- **External Integrasi**: Google Gmail API, Google Calendar OAuth API.
- **Spreadsheet Engine**: SheetJS (`xlsx`) untuk import & export katalog produk.

---

## 📋 Environment Variables (`.env`)

Buat file `.env` di root project. Nama variabel harus sama persis dengan yang dipakai kode (dan dengan Environment Variables di Vercel):

```env
# Database PostgreSQL (Supabase / lokal)
DATABASE_URL="postgresql://user:password@localhost:5432/kasirpro_dev?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/kasirpro_dev?schema=public"   # dipakai Prisma CLI (prisma.config.ts)

# NextAuth (Auth.js v5)
AUTH_SECRET="your_secure_auth_secret_key"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"   # dipakai untuk redirect Google OAuth

# OpenRouter AI (Vision Model untuk Scan Nota Belanja)
OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx"
OPENROUTER_MODEL="openai/gpt-6-luna"   # opsional

# Supabase Storage (upload foto nota)
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

# Google OAuth (Google Calendar & Gmail Flip)
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# Cron Job Secret (WAJIB — tanpa ini endpoint cron menolak semua request)
CRON_SECRET="your_cron_secret_token"
```

---

## 🚀 Cara Menjalankan Project

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/haydiru/Kasir-Pro.git
   cd Kasir-Pro
   npm install
   ```

2. **Siapkan Database** (pakai database dev, jangan database production):
   ```bash
   npx prisma db push
   npx prisma db execute --schema prisma/schema.prisma --file prisma/sql/20261019_activity_log.sql
   npx tsx prisma/seed.ts
   ```
   File SQL membuat tabel `ActivityLog` beserta trigger append-only dan RLS. Data seed berisi 1 toko dan 3 akun contoh (Super Admin, Kasir, Pramuniaga).

3. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
   Buka browser di `http://localhost:3000`.

4. **Kompilasi & Build Produksi**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🚢 Deploy ke Production (Vercel + Supabase)

Build (`prisma generate && next build`) **tidak** mengubah database. Setiap ada perubahan schema:

1. Terapkan perubahan tabel ke database production terlebih dahulu (`npx prisma db push` dengan `DIRECT_URL` production, atau jalankan SQL di Supabase SQL Editor).
2. Untuk log aktivitas, jalankan isi `prisma/sql/20261019_activity_log.sql` sekali di Supabase SQL Editor (aman diulang). Tanpa tabel ini, aksi yang dicatat log akan gagal.
3. Pastikan semua Environment Variables di atas ada di Vercel, termasuk `CRON_SECRET`, dan pemanggil cron mengirim header `Authorization: Bearer <CRON_SECRET>`.
4. Merge ke `main` → Vercel otomatis deploy ke production.

---

## 🗂️ 3-Agent Task Tracking System

Project ini dikelola secara disiplin menggunakan **3 File Agent Task Tracking**:

1. **🔴 [tasks_todo.md](tasks_todo.md)**: Daftar task backlog yang belum dikerjakan, diurutkan per Phase & terukur per halaman.
2. **🟡 [tasks_in_progress.md](tasks_in_progress.md)**: Task aktif yang sedang dikerjakan saat ini.
3. **🟢 [tasks_done.md](tasks_done.md)**: Arsip seluruh task yang telah selesai dan diverifikasi di produksi.

```
[tasks_todo.md] ➡️ [tasks_in_progress.md] ➡️ [tasks_done.md]
```

---

## 📝 Lisensi

MIT License © 2026 KasirPro Team.
