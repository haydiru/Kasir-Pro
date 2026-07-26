import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true }
  });

  const title = "✨ Fitur Baru: Petty Cash & Supplier!";
  const message = "Telah hadir fitur Laporan Belanja Pegawai (Petty Cash) dengan kompresi foto otomatis, Autocomplete Supplier & Impor Excel, serta Share Link Barang Kosong Rak. Klik untuk membaca Panduan Lengkap.";
  const link = "/panduan";
  const type = "SYSTEM";

  console.log(`Menemukan ${users.length} pengguna di database.`);
  console.log("Memulai pengiriman notifikasi fitur baru...");

  let createdCount = 0;
  let skipCount = 0;

  for (const user of users) {
    // Hindari notifikasi ganda dengan mencocokkan title dan userId
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        title,
        type
      }
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title,
          message,
          type,
          link,
          isRead: false
        }
      });
      createdCount++;
      console.log(`[SUKSES] Notifikasi terkirim untuk user: ${user.name}`);
    } else {
      skipCount++;
      console.log(`[LEWATI] User ${user.name} sudah menerima notifikasi ini.`);
    }
  }

  console.log("\n==============================================");
  console.log(`Selesai! Berhasil mengirim ke ${createdCount} pengguna.`);
  console.log(`Dilewati (sudah ada): ${skipCount} pengguna.`);
  console.log("==============================================");
}

main()
  .catch((e) => {
    console.error("Gagal menjalankan script notifikasi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
