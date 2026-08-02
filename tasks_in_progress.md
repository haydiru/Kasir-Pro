# 🟡 Agent 2: Tasks In Progress (Task Sedang Dikerjakan)

Dokumen ini mencatat task yang **SEDANG AKTIF DIKERJAKAN** oleh AI assistant. Setelah seluruh instruksi dan verifikasi selesai, task dari file ini akan dipindahkan secara otomatis ke `tasks_done.md`.

---

## 🔄 Active Task Board

### 🎯 [IN_PROGRESS-01] Penyempurnaan & Visualisasi Laporan PDF Export untuk Verifikasi Shift
- **Phase**: Phase 2 - Backend & Reporting
- **Kategori**: PDF Report Generator
- **Target Halaman**: `/admin/verifications` & `/cashier/report/[id]/print`
- **Deskripsi Detail**:
  1. Menambahkan tombol **Export PDF Laporan Shift LENGKAP** pada modal verifikasi admin dan halaman cetak kasir.
  2. PDF berisi rincian:
     - Header Toko & Identitas Kasir / Jam Shift.
     - Rincian Uang Fisik, POS Cash, POS Debit.
     - Tabel Transaksi Digital & Bukti Flip.
     - Tabel Pengeluaran Kasir & Nota Lampiran.
     - Akurasi Kas Fisik & Catatan Verifikasi Admin.
- **Langkah Pengerjaan**:
  - [x] Membuat layout pratinjau cetak struk termal.
  - [ ] Menambahkan template standar PDF siap download / cetak A4.
  - [ ] Integrasi tombol download PDF pada modal admin verifikasi.
  - [ ] Verifikasi format tanggal local WIB & angka mata uang.

---

## 📌 Aturan Perpindahan Status Task:
1. Apabila task `[IN_PROGRESS-01]` selesai diverifikasi dengan `npm run build`, move task ke `tasks_done.md`.
2. Ambil task berikutnya dari urutan paling atas di `tasks_todo.md` dan pindahkan ke file ini (`tasks_in_progress.md`).
