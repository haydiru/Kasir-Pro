# 🟡 Agent 2: Tasks In Progress (Task Sedang Dikerjakan)

Dokumen ini mencatat task yang **SEDANG AKTIF DIKERJAKAN** oleh AI assistant. Setelah seluruh instruksi dan verifikasi selesai, task dari file ini akan dipindahkan secara otomatis ke `tasks_done.md`.

---

## 🔄 Active Task Board

### 🎯 [FEAT-01] Modul Hapus Single & Hapus Massal Transaksi Flip Khusus Super Admin (`/admin/flip-transactions`)
- **Phase**: Administration & Data Management
- **Kategori**: Role Authorization & Bulk Action
- **Target File**:
  - `app/actions/flip.ts`
  - `app/(dashboard)/admin/flip-transactions/page.tsx`
  - `app/(dashboard)/admin/flip-transactions/flip-client.tsx`
- **Deskripsi Detail & Kebutuhan Pengguna**:
  - Memfasilitasi Super Admin untuk menghapus data transaksi Flip yang duplikasi / error dari periode sebelumnya.
  - Menambahkan Server Actions `deleteFlipTransaction` dan `bulkDeleteFlipTransactions` dengan validasi strict role `super_admin`.
  - Menambahkan Checkbox pemilih pada setiap baris tabel & Checkbox "Pilih Semua" (Select All) pada header tabel.
  - Menambahkan Floating Action Bar di bagian bawah layar ketika ada transaksi yang dipilih, menampilkan tombol **"Hapus [X] Transaksi Massal"**.
  - Menambahkan Dialog konfirmasi hapus sebelum mengeksekusi penghapusan data.
- **Langkah Pengerjaan**:
  - [x] Analisis kebutuhan Super Admin pada halaman Flip Transactions.
  - [ ] Implementasi Server Actions `deleteFlipTransaction` & `bulkDeleteFlipTransactions` di `app/actions/flip.ts`.
  - [ ] Oper prop `isSuperAdmin` dari `page.tsx` ke `flip-client.tsx`.
  - [ ] Implementasi Checkbox, Single Delete Button, Bulk Delete Floating Bar & Confirm Dialog di `flip-client.tsx`.
  - [ ] Running build verification (`npm run build`).

---

## 📌 Aturan Perpindahan Status Task:
1. Apabila task `[FEAT-01]` selesai diverifikasi dengan `npm run build`, move task ke `tasks_done.md`.
2. Ambil task berikutnya dari urutan paling atas di `tasks_todo.md` dan pindahkan ke file ini (`tasks_in_progress.md`).
