# 🟡 Agent 2: Tasks In Progress (Task Sedang Dikerjakan)

Dokumen ini mencatat task yang **SEDANG AKTIF DIKERJAKAN** oleh AI assistant. Setelah seluruh instruksi dan verifikasi selesai, task dari file ini meupun task done dipindahkan secara berurutan.

---

## 🔄 Active Task Board

### 🚀 [PERF-01] Optimasi Performa Transaksi Flip (Ganti Bulan & Deletion Instant Speed)
- **Cakupan Halaman**: `/admin/flip-transactions`
- **Permasalahan**: Ganti bulan terasa sangat lambat (membutuhkan 3-10 detik) dan aksi hapus kadang cepat kadang lambat.
- **Akar Masalah**:
  1. `useEffect` di `flip-client.tsx` memanggil `syncFlipEmailsFromGmail()` yang melakukan query network & OAuth Gmail 200 email setiap kali state `month` atau `year` berubah.
  2. `getFlipTransactions` di `app/actions/flip.ts` memanggil `prisma.digitalTransaction.findMany` tanpa filter `flipId`, melakukan full table scan pada seluruh riwayat transaksi digital.
  3. Action `deleteFlipTransaction` & `bulkDeleteFlipTransactions` memanggil `revalidatePath` yang memaksa re-render server padahal client sudah melalukan optimistic update UI.
  4. Kurang indeks database gabungan pada `FlipWebhook` (`[storeId, transactionTime]`) dan `DigitalTransaction` (`[flipId]`).
- **Rincian Solusi & Rencana Implementasi**:
  - [ ] **1. Optimasi Trigger Sync Gmail**: Ubah `useEffect` agar `syncFlipEmailsFromGmail()` hanya dipanggil saat initial mount, bukan setiap perubahan filter `month`/`year`.
  - [ ] **2. Targeted Query Matching**: Update `getFlipTransactions` agar query `DigitalTransaction` hanya mencari `flipId` yang ada pada halaman bulan tersebut (`flipId: { in: dbFlipIds }`), mengubah *full table scan* menjadi *index seek*.
  - [ ] **3. Fast Deletion & Background Revalidation**: Hapus overhead revalidate manual berlebih pada aksi hapus single/massal agar respon API instan (<100ms).
  - [ ] **4. Database Indexing**: Tambahkan index `@@index([storeId, transactionTime])` pada `FlipWebhook` dan `@@index([flipId])` pada `DigitalTransaction` di `prisma/schema.prisma`.
  - [ ] **5. Verification**: Jalankan `npx prisma db push` dan `npm run build` untuk memastikan performa optimal dan build bersih.

---

## 📌 Aturan Perpindahan Status Task:
1. Apabila task selesai diverifikasi dengan `npm run build`, move task ke `tasks_done.md`.
2. Ambil task berikutnya dari urutan paling atas di `tasks_todo.md` dan pindahkan ke file ini (`tasks_in_progress.md`).
