# Kasir-App: Mini Market Shift Report System

Sistem manajemen shift dan pelaporan harian untuk minimarket modern. Dibangun dengan Next.js 15, Prisma, dan PostgreSQL.

## 🚀 Fitur Utama

- **Dashboard Admin Premium**: Kelola identitas toko dan pengaturan shift dengan antarmuka modern (Glassmorphism UI).
- **Sistem Shift Dinamis**: Konfigurasi jam kerja (Pagi/Malam) dan dukungan jadwal khusus untuk hari tertentu (misal: Hari Minggu).
- **Presensi Karyawan**: Sistem Clock-In/Clock-Out yang sinkron dengan jadwal toko.
- **Laporan Shift Otomatis**: Rekapitulasi transaksi, pengeluaran, dan kas awal/akhir per shift.
- **Manajemen User**: Pengaturan peran Kasir, Pramuniaga, dan Admin.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (via Supabase/Prisma)
- **Styling**: Tailwind CSS & Shadcn UI
- **Auth**: NextAuth.js (Auth.js)
- **ORM**: Prisma

## 📦 Instalasi

1. Clone repositori ini:
   ```bash
   git clone [URL_REPOSITORI]
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

3. Atur environment variables (`.env`):
   ```env
   DATABASE_URL="your_postgresql_url"
   NEXTAUTH_SECRET="your_secret"
   ```

4. Jalankan migrasi database:
   ```bash
   npx prisma db push
   ```

5. Jalankan project:
   ```bash
   npm run dev
   ```

## 📝 Lisensi

MIT
