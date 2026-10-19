# 🔴 Agent 1: Backlog Tasks (Daftar Task Belum Dikerjakan)

Dokumen ini berisi daftar seluruh rencana task yang **BELUM DIKERJAKAN**, dikelompokkan secara terstruktur per Phase (Frontend per Halaman, Backend & Database per Fitur). 

Setiap task diatur dengan cakupan yang **terukur & fungsional** (maksimal 1 halaman atau 1 part per task) agar konteks AI tetap akurat dan tidak meluap.

---

## 🎨 Phase 1: Frontend Enhancements (Tampilan & UI Per Page)

### 📋 [TODO-FE-01] Halaman Panduan Kasir & SOP Interaktif (`/panduan`)
- **Cakupan Halaman**: 1 Page (`/panduan`)
- **Rincian Fitur Detail**:
  - [ ] Tabbed UI berisi SOP Pembukaan Shift, Operasional Digital (Flip/PLN), Pencatatan Retur, dan Penutupan Kas.
  - [ ] Pencarian kata kunci instruksi SOP (Search Bar responsif).
  - [ ] Modul Video/Infografis visual panduan penanganan selisih uang kasir dan panduan foto nota belanja AI.
  - [ ] Tombol konfirmasi "Saya Sudah Membaca & Memahami SOP" bagi kasir baru.

### 📋 [TODO-FE-02] Halaman Pramuniaga Entries & Checklist Tugas Toko (`/pramuniaga/entries`)
- **Cakupan Halaman**: 1 Page (`/pramuniaga/entries`)
- **Rincian Fitur Detail**:
  - [ ] Checklist tugas kebersihan & kerapian rak toko per shift pramuniaga.
  - [ ] Form input penataan display barang (Facing Out) & cek tanggal kadaluwarsa (Expired Date Check).
  - [ ] Form pelaporan barang rusak di rak toko (sebelum dipindahkan ke retur).
  - [ ] Riwayat catatan pramuniaga harian dengan status verifikasi supervisor/admin.

### 📋 [TODO-FE-03] Barcode Scanner Camera (PWA / WebRTC) untuk Master Barang & Kasir
- **Cakupan Halaman**: Modal Kamera Scanner di `/products` dan `/cashier/report`
- **Rincian Fitur Detail**:
  - [ ] Pemindaian barcode kamera langsung menggunakan library HTML5 QR/Barcode Code Scanner (QuaggaJS / @zxing/library).
  - [ ] Auto-focus dan switch kamera belakang (Environment mode).
  - [ ] 1-klik cari barang di Master Data Barang (`/products`) menggunakan barcode fisik produk.
  - [ ] Opsi pencarian cepat barcode untuk input barang pengeluaran belanja.

### 📋 [TODO-FE-04] Multi-Branch Consolidated Summary Dashboard (Overview Lintas Cabang untuk Super Admin)
- **Cakupan Halaman**: 1 Page (`/admin/branches-overview`)
- **Rincian Fitur Detail**:
  - [ ] Matriks komparasi omzet seluruh cabang toko dalam satu tampilan ringkas.
  - [ ] Grafik tren performa cabang terbaik vs cabang dengan pertumbuhan lambat.
  - [ ] Filter pembanding rentang waktu dan ekspor ringkasan performa multi-cabang.

---

## ⚙️ Phase 2: Backend & Database Enhancements (Server Actions, API & Schema)

### 🗄️ [TODO-BE-01] Server Action & Data Model Checklist Pramuniaga (`app/actions/pramuniaga.ts`)
- **Cakupan Fitur**: Backend Server Action Pramuniaga & Prisma Schema
- **Rincian Fitur Detail**:
  - [ ] Model Prisma `PramuniagaEntry` & `ChecklistItem`.
  - [ ] `submitPramuniagaTask`: Simpan checklist & bukti foto pengerjaan tugas ke Vercel Blob.
  - [ ] `getPramuniagaEntries`: Fetch riwayat laporan tugas pramuniaga per tanggal & shift.
  - [ ] Notifikasi otomatis ke supervisor jika ada tugas kebersihan atau display yang belum tuntas.

### 🗄️ [TODO-BE-02] Automated Low-Stock & Price Spike Notification Bot (WhatsApp / Telegram Webhook)
- **Cakupan Fitur**: Background Alert Engine
- **Rincian Fitur Detail**:
  - [ ] Trigger otomatis saat kenaikan harga modal terdeteksi dari hasil Scan AI atau Import Excel.
  - [ ] Webhook pengiriman ringkasan barang yang naik ke grup WhatsApp / Telegram Owner Toko.
  - [ ] Peringatan otomatis stok minimum barang fast-moving yang habis di rak.

### 🗄️ [TODO-BE-03] Background Cleanup Job untuk Mutasi Flip Webhook & Log Lama
- **Cakupan Fitur**: Scheduled Database Optimization
- **Rincian Fitur Detail**:
  - [ ] Cron endpoint untuk membersihkan log `FlipWebhook` yang sudah berusia lebih dari 90 hari.
  - [ ] Pengarsipan data berkala tanpa memengaruhi laporan historis shift kasir.
  - [ ] **Catatan**: `ActivityLog` sengaja append-only (trigger DB menolak DELETE) dan **tidak** ikut dibersihkan. Jika kelak perlu retensi, buat proses arsip terpisah yang disetujui owner.

---

## 📊 Phase 3: Advanced Analytics, Export & Performance Optimization

### 🚀 [TODO-ADV-01] Export Excel Rekap Performa Pegawai & Omzet Toko (`app/actions/export.ts`)
- **Cakupan Fitur**: Excel Export Engine (SheetJS / ExcelJS)
- **Rincian Fitur Detail**:
  - [ ] Download file Excel Rekap Penjualan Kasir (Termasuk Total Omzet, Cash, Debit, % Debit, Laba Digital, dan Akurasi Kas).
  - [ ] Format worksheet rapi dengan styling header emerald, highlight warna selisih, dan rumus total otomatis.

### 🚀 [TODO-ADV-02] Cache Optimization & Speed Enhancement (`app/actions/dashboard.ts`)
- **Cakupan Fitur**: Performance & Query Optimization
- **Rincian Fitur Detail**:
  - [ ] Implementasi Next.js `unstable_cache` / React `cache` pada query statistik dashboard all-time agar waktu muat di bawah 300ms.
  - [ ] Optimasi penarikan data Prisma `shiftReport` dengan indeks gabungan `[storeId, status, date]`.

---

## 🛡️ Phase 4: Lanjutan Keamanan (Sisa Temuan Audit Medium/Low, 19 Okt 2026)

### 🔐 [TODO-SEC-01] Migrasi Database Terkelola (Prisma Migrate)
- [ ] Buat baseline migrasi dari database production, simpan di `prisma/migrations`, dan masukkan SQL trigger `ActivityLog` ke dalam migrasi.
- [ ] Ubah build menjadi `prisma generate && prisma migrate deploy && next build` agar setiap deploy otomatis menerapkan migrasi baru.

### 🔐 [TODO-SEC-02] Penguatan Login & PIN
- [ ] Rate limit login berbasis storage bersama (mis. tabel DB / Upstash), karena rate limiter in-memory tidak efektif di serverless.
- [ ] Wajib ganti PIN saat login pertama / setelah reset ke `123456`; minimal PIN 6 digit.
- [ ] Opsi menonaktifkan pengguna (soft disable) tanpa menghapus akun.

### 🔐 [TODO-SEC-03] Validasi & Konsistensi Data Keuangan
- [ ] `createFinancialTransaction`: pindahkan cek saldo ke dalam transaksi (cegah race condition), validasi `type`/`amount` dengan zod, larang mendebit kas pegangan admin lain.
- [ ] Hapus laporan `Verified`: wajib batal verifikasi dulu agar saldo Buku Kas ikut dikoreksi.
- [ ] Soft delete (`deletedAt`, `deletedById`) untuk data keuangan alih-alih hard delete.

### 🔐 [TODO-SEC-04] Integrasi & Dependensi
- [ ] Query Gmail `(from:flip.id OR "flip.id")` menerima email apa pun yang memuat teks "flip.id"; batasi ke pengirim resmi Flip untuk mencegah transaksi palsu.
- [ ] Enkripsi token Google (`StoreGoogleAuth`) dan `flipApiKey` di database.
- [ ] Ganti `xlsx@0.18.5` (CVE prototype pollution & ReDoS) dengan build SheetJS resmi terbaru atau ExcelJS.
- [ ] `scanReceiptWithAi`: hapus parameter `bypassToggle` dari client & batasi jumlah item hasil AI.

### 🔐 [TODO-SEC-05] Cakupan Log & Validasi Minor
- [ ] Tambah log aktivitas untuk barang retur, barang kosong (termasuk tautan publik), dan webhook email Flip.
- [ ] Validasi status (allowlist) di `retur.ts` dan batasi hapus retur untuk admin.
- [ ] Batasi `limit` pada `getNotifications` dan validasi `shiftType` saat check-in.

---

## 🔁 Alur Kerja Pemindahan Task:
1. Pilih 1 Task dari urutan teratas `tasks_todo.md`.
2. Pindahkan task tersebut ke `tasks_in_progress.md` saat mulai dikerjakan.
3. Setelah kodenya ditulis, di-build dengan `npm run build`, dan di-commit, pindahkan task tersebut ke `tasks_done.md`.
