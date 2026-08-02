# 🛒 KasirPro — Minimarket Shift & Financial Report System

**KasirPro** adalah sistem manajemen shift, verifikasi transaksi kasir, pencatatan kas kecil, retur barang, dan analisa performa minimarket modern yang terintegrasi secara real-time. Dibangun menggunakan **Next.js 16 (App Router)**, **Prisma ORM**, **PostgreSQL**, dan **Vercel Blob Storage**.

---

## 🌟 Fitur Utama & Modul Sistem

### 1. 📊 Admin Dashboard & Smart Analytics (`/admin/dashboard`)
- **Kartu Real-Time Omzet Hari Ini**: Menampilkan omzet murni transaksi POS hari ini tanpa terdistorsi oleh filter rentang tanggal.
- **Financial Summary Cards**: Total Omzet Periode, Omzet Cash, Omzet Debit, Total Pengeluaran Operasional, Pendapatan Digital, dan Laba Digital.
- **Filter Rentang Tanggal Preset**:
  - `Hari Ini` (1 Hari)
  - `7 Hari`
  - `30 Hari`
  - `90 Hari (3 Bulan)`
  - `Tahun Ini` (365 Hari)
  - `Semua (All Time)` (Dari awal berdiri hingga sekarang)
- **Analisa Weekday vs Weekend (Pola Konsumsi Masyarakat)**:
  - Perbandingan total omzet, rata-rata omzet per shift, dan rasio Cash vs Debit di hari kerja (Senin–Jumat) vs akhir pekan (Sabtu–Minggu).
  - Persentase **Weekend Surge %** dan deteksi otomatis hari terramai (busiest day).
- **Smart Recommendations & Sales Opportunities Engine**:
  - Deteksi otomatis kasir omzet tertinggi, jawara laba digital, peluang upselling layanan digital, dan peringatan akurasi kasir di bawah 80%.
- **Grafik Growth Multi-Perspektif**:
  - Visualisasi omzet Cash vs Debit, Pengeluaran Toko, dan Pendapatan & Laba Digital dengan toggle tampilan: **`Harian (Daily)`**, **`Per Minggu (Weekly)`**, dan **`Per Bulan (Monthly)`**.
- **Tabel Peringkat Pegawai (Leaderboard)**:
  - Menyajikan performa kasir: Medali Peringkat (🥇 🥈 🥉), Jumlah Shift, Total Omzet POS, **Omzet Debit (Nominal & Persentase % Non-Tunai)**, Rata-rata Omzet/Shift, Laba Digital Disumbang, Produk Digital Favorit, dan Akurasi Kas Fisik (% Akurasi & Selisih).

### 2. 📑 Laporan Shift Kasir & Cetak Struk (`/cashier/report`, `/cashier/report/[id]/print`)
- **Form Laporan Shift**:
  - Input Modal Awal, Omzet POS Cash, dan Omzet POS Debit.
  - Pencatatan Transaksi Digital (Top Up E-Wallet, Token PLN, Pulsa, dll.) dengan fitur **Auto Match ID Flip**.
  - Pencatatan Pengeluaran Kasir dengan kompresi client-side foto nota & upload otomatis ke Vercel Blob.
  - Perhitungan otomatis Kas Fisik yang Diharapkan (*Expected Cash*) & Selisih (*Variance*).
- **Cetak Struk Termal**:
  - Layout struk termal (58mm/80mm) & pratinjau siap cetak/PDF.

### 3. 📸 Presensi & Absensi Live (`/attendance`, `/admin/attendance`)
- **Clock-In / Clock-Out**:
  - Pemilihan jenis shift (Pagi, Siang, Malam) dengan upload foto bukti kehadiran.
- **Monitoring Live & Rekap Payroll**:
  - Monitoring pegawai yang sedang aktif bertugas.
  - Rekapitulasi absensi & gaji bulanan pegawai dengan navigasi offset bulan.

### 4. 📦 Pencatatan Barang Retur Supplier (`/retur`)
- **Mode Tampilan List / Tabel Ringkas (Default)**:
  - Tampilan tabel berdensitas tinggi untuk melihat seluruh catatan retur barang cacat/rusak/expired secara keseluruhan di layar.
- **Mode Tampilan Kartu (Card View)**:
  - Tampilan kartu grid kelompok per supplier.
- **Fitur Batch Action / Operasi Massal**:
  - Aksi massal "Kirim Semua", "Selesaikan Semua", dan "Hapus Massal" via Floating Action Bar.
- **Alur Status Retur**: `PENDING` (Di Toko) ➡️ `RETURNED` (Telah Dikirim) ➡️ `RESOLVED` (Selesai/Clear) dengan tombol Undo.

### 5. 💰 Laporan Kas Kecil & Pengeluaran User (`/shopping-funds`)
- **Pemberian Dana**:
  - Form pencatatan pemberian dana operasional dari Owner/Admin ke pegawai.
- **Laporan Belanja Operasional**:
  - Pelaporan pengeluaran oleh pegawai beserta upload foto struk/nota.
- **Aturan Akses Penghapusan**:
  - Khusus **Super Admin** yang memiliki wewenang menghapus transaksi pemberian dana maupun pengeluaran dana (berguna untuk testing & koreksi entri salah).

### 6. ⚠️ Barang Kosong & Shareable Link (`/empty-items`, `/share/empty-items/[storeId]`)
- Catat barang kosong/stok habis oleh kasir/pramuniaga dengan foto produk.
- Halaman publik share untuk supplier/bagian purchasing tanpa perlu login.

### 7. ✉️ Sync Gmail Flip Webhook Auto-Matching (`/admin/flip-transactions`, `/api/cron/sync-flip-gmail`)
- Cron job otomatis membaca email konfirmasi transaksi Flip dari Gmail API.
- Parsing regex ID Flip, nominal, status, dan pencocokan otomatis dengan transaksi kasir.
- Fallback tampilan: Jika ID yang diinputkan kasir salah/tidak cocok, sistem tetap menampilkan ID inputan asli kasir beserta warning penjelasan entri salah.

### 8. 🛠️ Setelan Toko, Supplier & Manajemen User (`/admin/suppliers`, `/admin/users`, `/admin/store-settings`)
- Master Data Supplier dengan Import Excel massal.
- Manajemen User & Role (`super_admin`, `admin`, `cashier`, `pramuniaga`) & Reset PIN.
- Setelan Profil Toko, Timezone (misal: `Asia/Jakarta`), Jam Operasional, dan Pengaturan Margin Laba Layanan Digital.

---

## 🛠️ Tech Stack & Dependencies

- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS, Lucide React Icons.
- **UI Components**: Radix UI / Shadcn UI (`Card`, `Badge`, `Button`, `Table`, `Dialog`, `Select`, `Input`).
- **Data Visualization**: Recharts (`BarChart`, `LineChart`, `AreaChart`).
- **Backend & API**: Next.js Server Actions, NextAuth.js (Auth.js v5).
- **Database & ORM**: PostgreSQL, Prisma ORM (v6).
- **Storage**: Vercel Blob Storage (Upload Foto Absensi, Nota Pengeluaran, & Retur).
- **External Services**: Google Gmail API (Flip Email Webhook Sync).

---

## 📋 Environment Variables Configuration (`.env`)

Buat file `.env` di root project dengan konfigurasi berikut:

```env
# Database PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/kasirpro_db?schema=public"

# NextAuth Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret_key"

# Vercel Blob Storage (Image Uploads)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token_here"

# Google OAuth & Gmail API Sync (Flip Integration)
GMAIL_CLIENT_ID="your_google_client_id"
GMAIL_CLIENT_SECRET="your_google_client_secret"
GMAIL_REFRESH_TOKEN="your_google_refresh_token"
GMAIL_USER_EMAIL="your_store_email@gmail.com"

# Cron Job Secret
CRON_SECRET="your_cron_secret_token"
```

---

## 🚀 Cara Menjalankan Project

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/haydiru/Kasir-Pro.git
   cd Kasir-Pro/kasir-app
   npm install
   ```

2. **Generate Prisma Client & Push Migration**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
   Buka browser di `http://localhost:3000`.

4. **Build untuk Produksi**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🗂️ 3-Agent Task Tracking System

Project ini dikelola menggunakan **3 File Agent Task Tracking** untuk memastikan setiap pengerjaan terukur, fokus, dan tidak melebihi konteks:

1. **🔴 [tasks_todo.md](file:///d:/Website/casir%20minimarket%20shift%20report/kasir-app/tasks_todo.md)**: Daftar task backlog yang belum dikerjakan, diurutkan per Phase & maksimal 1 Halaman per task.
2. **🟡 [tasks_in_progress.md](file:///d:/Website/casir%20minimarket%20shift%20report/kasir-app/tasks_in_progress.md)**: Task aktif yang sedang dikerjakan.
3. **🟢 [tasks_done.md](file:///d:/Website/casir%20minimarket%20shift%20report/kasir-app/tasks_done.md)**: Arsip seluruh task yang telah selesai dan diuji 100%.

```
[tasks_todo.md] ➡️ [tasks_in_progress.md] ➡️ [tasks_done.md]
```

---

## 📝 Lisensi

MIT License © 2026 KasirPro Team.
