import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Mulai melakukan seeding (inisialisasi data awal)...");

  // 1. Buat Toko Induk
  const store = await prisma.store.create({
    data: {
      name: "Minimart Sejahtera - Cabang Utama",
      address: "Jl. Sudirman No 123",
    },
  });
  console.log("✅ Toko berhasil dibuat.");

  // 2. Hash PIN default "123456"
  const defaultPin = "123456";
  const hashedPin = await bcrypt.hash(defaultPin, 10);

  // 3. Buat Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      storeId: store.id,
      name: "Budi Santoso",
      email: "budi@minimart.id",
      role: "super_admin",
      pin: hashedPin,
      payrollCycleStart: 25,
      payrollCycleEnd: 24,
    },
  });
  console.log("✅ Akun Super Admin dibuat (budi@minimart.id / PIN: 123456)");

  // 4. Buat akun Kasir 
  const cashier = await prisma.user.create({
    data: {
      storeId: store.id,
      name: "Andi Wijaya",
      email: "andi@minimart.id",
      role: "cashier",
      pin: hashedPin,
      payrollCycleStart: 25,
      payrollCycleEnd: 24,
    },
  });
  console.log("✅ Akun Kasir dibuat (andi@minimart.id / PIN: 123456)");

  // 5. Buat akun Pramuniaga
  const pramuniaga = await prisma.user.create({
    data: {
      storeId: store.id,
      name: "Nina",
      email: "nina@minimart.id",
      role: "pramuniaga",
      pin: hashedPin,
      payrollCycleStart: 25,
      payrollCycleEnd: 24,
    },
  });
  console.log("✅ Akun Pramuniaga dibuat (nina@minimart.id / PIN: 123456)");

  console.log("🎉 Seeding selesai!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
