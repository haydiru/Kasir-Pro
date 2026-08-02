# 🔴 Agent 1: Backlog Tasks (Daftar Task Belum Dikerjakan)

Dokumen ini berisi daftar seluruh rencana task yang **BELUM DIKERJAKAN**, dikelompokkan secara terstruktur per Phase (Frontend per Halaman, Backend & Database per Fitur). 

Setiap task diatur dengan cakupan yang **terukur & fungsional** (maksimal 1 halaman atau 1 part per task) agar konteks AI tetap akurat dan tidak meluap.

---

## 🎨 Phase 1: Frontend Enhancements (Tampilan & UI Per Page)

### 📋 [TODO-FE-01] Halaman Panduan Kasir & SOP Interaktif (`/panduan`)
- **Cakupan Halaman**: 1 Page (`/panduan`)
- **Rincian Fitur Detail**:
  - [ ] Tabbed UI berisi SOP Pembukaan Shift, Operasional Digital (Flip/PLN), Pencatatan Retur, dan Penutupan Kas.
  - [ ] Pencarian kata kunci instruksi SOP (Search Bar).
  - [ ] Modul Video/Infografis visual panduan penanganan selisih uang kasir.
  - [ ] Tombol konfirmasi "Saya Sudah Membaca & Memahami SOP" bagi kasir baru.

### 📋 [TODO-FE-02] Halaman Pramuniaga Entries & Checklist Stok (`/pramuniaga/entries`)
- **Cakupan Halaman**: 1 Page (`/pramuniaga/entries`)
- **Rincian Fitur Detail**:
  - [ ] Checklist tugas kebersihan & kerapian rak toko per shift pramuniaga.
  - [ ] Form input penataan display barang (Facing Out) & cek tanggal kadaluwarsa (Expired Date Check).
  - [ ] Form pelaporan barang rusak di rak toko (sebelum diretur).
  - [ ] Riwayat catatan pramuniaga harian dengan status verifikasi supervisor.

### 📋 [TODO-FE-03] Halaman Admin Notifikasi & Alert Center (`/notifications`)
- **Cakupan Halaman**: 1 Page (`/notifications`) - *Mengatasi 404 & menyempurnakan UI*
- **Rincian Fitur Detail**:
  - [ ] Pusat notifikasi real-time untuk Admin & Super Admin.
  - [ ] Alert otomatis untuk:
    - Laporan shift kasir dengan selisih kas > Rp 10.000.
    - Transaksi Flip E-Wallet yang belum terpasangkan (unmatched Flip count).
    - Pemberian dana kas kecil yang belum dilaporkan.
    - Barang retur pending lebih dari 3 hari.
  - [ ] Filter notifikasi: `Semua`, `Belum Dibaca`, `Penting / Warning`, `Transaksi`.
  - [ ] Tombol "Tandai Semua Telah Dibaca" & tautan langsung ke halaman terkait.

### 📋 [TODO-FE-04] Halaman Admin Cashflow & Modul Kas Kecil (`/admin/cashflow`) - Part 1: UI Ledger
- **Cakupan Halaman**: 1 Page (`/admin/cashflow`)
- **Rincian Fitur Detail**:
  - [ ] Buku Besar (Ledger) Pemasukan vs Pengeluaran Kas Toko.
  - [ ] Visualisasi Grafik Arus Kas Harian & Mingguan.
  - [ ] Widget Saldo Kas Utama vs Saldo Kas Kecil Operasional.
  - [ ] Filter transaksi arus kas berdasarkan tanggal, jenis (Debit/Kredit), dan kategori.

### 📋 [TODO-FE-05] Halaman Admin Cashflow (`/admin/cashflow`) - Part 2: Export & Audit Trail
- **Cakupan Halaman**: 1 Page (`/admin/cashflow`)
- **Rincian Fitur Detail**:
  - [ ] Export Laporan Arus Kas ke format Excel (.xlsx) & PDF.
  - [ ] Audit Trail pencatatan mutasi kas oleh Super Admin vs Admin.
  - [ ] Filter khusus transaksi kas kecil yang dihapus oleh Super Admin untuk testing/revisi.

---

## ⚙️ Phase 2: Backend & Database Enhancements (Server Actions, API & Schema)

### 🗄️ [TODO-BE-01] Server Action Notifications & Real-Time Sync (`app/actions/notification.ts`)
- **Cakupan Fitur**: Backend Server Action Notifikasi
- **Rincian Fitur Detail**:
  - [ ] `getNotifications(limit, unreadOnly)`: Mengambil daftar notifikasi store.
  - [ ] `markNotificationAsRead(id)` & `markAllNotificationsAsRead()`: Update status dibaca.
  - [ ] Triggers otomatis pada server action `createShiftReport`, `createPettyCashExpense`, dan `syncFlipTransactions`.

### 🗄️ [TODO-BE-02] Server Action Pramuniaga & Task Checklist (`app/actions/pramuniaga.ts`)
- **Cakupan Fitur**: Backend Server Action Pramuniaga
- **Rincian Fitur Detail**:
  - [ ] Model Prisma `PramuniagaEntry` & `ChecklistItem`.
  - [ ] `submitPramuniagaTask`: Simpan checklist & bukti foto pengerjaan tugas.
  - [ ] `getPramuniagaEntries`: Fetch riwayat laporan tugas pramuniaga per tanggal & shift.

### 🗄️ [TODO-BE-03] API & Cron Sync Improvement untuk Flip Email Auto-Matching (`app/api/cron/sync-flip-gmail/route.ts`)
- **Cakupan Fitur**: Automated Background Job & Matching Logic
- **Rincian Fitur Detail**:
  - [ ] Auto-match algoritma tingkat lanjut matching nominal + waktu transaksi Flip.
  - [ ] Webhook retry mechanism jika API Flip / Gmail mengalami error atau rate limit.
  - [ ] Pembersihan log webhook Flip yang sudah lewat dari 90 hari secara terjadwal.

---

## 📊 Phase 3: Advanced Analytics, Export & Performance Optimization

### 🚀 [TODO-ADV-01] Export Excel Rekap Performa Pegawai & Omzet Toko (`app/actions/export.ts`)
- **Cakupan Fitur**: Excel Export Engine (ExcelJS / SheetJS)
- **Rincian Fitur Detail**:
  - [ ] Download file Excel Rekap Penjualan Kasir (Termasuk Total Omzet, Cash, Debit, % Debit, Laba Digital, dan Akurasi Kas).
  - [ ] Format worksheet rapi dengan styling header, warna kondisi selisih, dan rumus total otomatis.

### 🚀 [TODO-ADV-02] Cache Optimization & Speed Enhancement (`app/actions/dashboard.ts`)
- **Cakupan Fitur**: Performance & Query Optimization
- **Rincian Fitur Detail**:
  - [ ] Implementasi Next.js `unstable_cache` / React `cache` pada query statistik dashboard all-time agar waktu muat di bawah 300ms.
  - [ ] Optimasi penarikan data Prisma `shiftReport` dengan indeks gabungan `[storeId, status, date]`.

---

## 🔁 Alur Kerja Pemindahan Task:
1. Pilih 1 Task dari urutan teratas `tasks_todo.md`.
2. Pindahkan task tersebut ke `tasks_in_progress.md` saat mulai dikerjakan.
3. Setelah kodenya ditulis, di-build dengan `npm run build`, dan di-commit, pindahkan task tersebut ke `tasks_done.md`.
