import { prisma } from "../lib/prisma";

async function syncCashflow() {
  console.log("=== MEMULAI SINKRONISASI ARUS KAS & BUKU KAS HISTORIS ===");

  const stores = await prisma.store.findMany({
    include: {
      users: {
        where: { role: { in: ["admin", "super_admin"] } }
      }
    }
  });

  for (const store of stores) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Toko: ${store.name} (${store.id})`);

    // 1. Pastikan Akun Bank Perusahaan (BANK_STORE) ada
    let bankAccount = await prisma.financialAccount.findFirst({
      where: { storeId: store.id, type: "BANK_STORE" }
    });

    if (!bankAccount) {
      bankAccount = await prisma.financialAccount.create({
        data: {
          storeId: store.id,
          name: "Rekening Bank Utama",
          type: "BANK_STORE",
          balance: 0,
        }
      });
      console.log(`[+] Akun BANK_STORE baru dibuat: ${bankAccount.name}`);
    } else {
      console.log(`[i] Akun BANK_STORE terdeteksi: ${bankAccount.name}`);
    }

    // Default admin fallback jika verifiedById null
    const defaultAdmin = store.users[0];
    if (!defaultAdmin) {
      console.log(`[!] Peringatan: Tidak ada admin pada toko ini, lewati.`);
      continue;
    }

    // 2. Ambil semua laporan shift yang sudah diverifikasi
    const verifiedReports = await prisma.shiftReport.findMany({
      where: { storeId: store.id, status: "Verified" },
      include: {
        user: true,
        digitalTransactions: true,
        expenditures: true,
        financialTransactions: true,
      },
      orderBy: { date: "asc" }
    });

    console.log(`[i] Ditemukan ${verifiedReports.length} laporan status Verified.`);

    let addedCashCount = 0;
    let addedDebitCount = 0;
    let addedDigitalCount = 0;
    let addedExpTrfCount = 0;

    for (const report of verifiedReports) {
      const verifierId = report.verifiedById || defaultAdmin.id;
      const verifier = store.users.find(u => u.id === verifierId) || defaultAdmin;

      // Pastikan verifier punya akun CASH_ADMIN
      let adminAccount = await prisma.financialAccount.findFirst({
        where: { storeId: store.id, userId: verifier.id, type: "CASH_ADMIN" }
      });

      if (!adminAccount) {
        adminAccount = await prisma.financialAccount.create({
          data: {
            storeId: store.id,
            userId: verifier.id,
            name: `Kas Pegangan ${verifier.name}`,
            type: "CASH_ADMIN",
            balance: 0,
          }
        });
      }

      const existingTxs = report.financialTransactions || [];
      const reportDateStr = report.date.toISOString().split("T")[0];
      const txTimestamp = report.verifiedAt || report.date;

      // A. Cek Setoran Cash Fisik (ke Kas Pegangan Admin)
      const hasCash = existingTxs.some(t => t.category === "Setoran Shift" && t.type === "INCOME");
      if (!hasCash && report.manualCashCount > 0) {
        await prisma.financialTransaction.create({
          data: {
            storeId: store.id,
            accountId: adminAccount.id,
            userId: verifier.id,
            type: "INCOME",
            category: "Setoran Shift",
            amount: report.manualCashCount,
            description: `Setoran shift ${report.shiftType} (Tunai Fisik) dari ${report.user.name} (${reportDateStr})`,
            shiftReportId: report.id,
            createdAt: txTimestamp,
          }
        });
        addedCashCount++;
      }

      // B. Cek Omzet POS Debit / QRIS (ke Rekening Bank Perusahaan)
      const hasDebit = existingTxs.some(t => t.category.includes("Debit") || t.category.includes("QRIS"));
      if (!hasDebit && (report.posDebit || 0) > 0) {
        await prisma.financialTransaction.create({
          data: {
            storeId: store.id,
            accountId: bankAccount.id,
            userId: verifier.id,
            type: "INCOME",
            category: "Setoran Shift (Debit / QRIS)",
            amount: report.posDebit,
            description: `Omzet POS Debit/QRIS shift ${report.shiftType} dari ${report.user.name} (${reportDateStr})`,
            shiftReportId: report.id,
            createdAt: txTimestamp,
          }
        });
        addedDebitCount++;
      }

      // C. Cek Transaksi Digital Non-Tunai / Transfer (ke Rekening Bank Perusahaan)
      const nonCashDigital = report.digitalTransactions
        .filter((d: any) => d.isNonCash)
        .reduce((sum: number, d: any) => sum + (d.grossAmount || 0), 0);

      const hasDigital = existingTxs.some(t => t.category === "Transaksi Digital (Transfer)");
      if (!hasDigital && nonCashDigital > 0) {
        await prisma.financialTransaction.create({
          data: {
            storeId: store.id,
            accountId: bankAccount.id,
            userId: verifier.id,
            type: "INCOME",
            category: "Transaksi Digital (Transfer)",
            amount: nonCashDigital,
            description: `Layanan digital transfer/non-tunai shift ${report.shiftType} (${reportDateStr})`,
            shiftReportId: report.id,
            createdAt: txTimestamp,
          }
        });
        addedDigitalCount++;
      }

      // D. Cek Pengeluaran Supplier yang Dibayar Transfer Bank (dari Rekening Bank Perusahaan)
      const trfExps = report.expenditures.filter((e: any) => (e.amountFromTransfer || 0) > 0);
      const totalTrfExp = trfExps.reduce((sum: number, e: any) => sum + (e.amountFromTransfer || 0), 0);

      const hasExp = existingTxs.some(t => t.type === "EXPENSE" && (t.category === "Tagihan" || t.category.includes("Transfer")));
      if (!hasExp && totalTrfExp > 0) {
        const suppliersList = trfExps.map((e: any) => e.supplierName).filter(Boolean).join(", ");
        await prisma.financialTransaction.create({
          data: {
            storeId: store.id,
            accountId: bankAccount.id,
            userId: verifier.id,
            type: "EXPENSE",
            category: "Tagihan",
            amount: totalTrfExp,
            description: `Pengeluaran transfer bank shift ${report.shiftType}: ${suppliersList || "Supplier"} (${reportDateStr})`,
            shiftReportId: report.id,
            createdAt: txTimestamp,
          }
        });
        addedExpTrfCount++;
      }
    }

    console.log(`[+] Mutasi Baru Dibuat:`);
    console.log(`    - Setoran Cash Fisik: ${addedCashCount}`);
    console.log(`    - Setoran POS Debit/QRIS: ${addedDebitCount}`);
    console.log(`    - Transaksi Digital Transfer: ${addedDigitalCount}`);
    console.log(`    - Pengeluaran Transfer Bank: ${addedExpTrfCount}`);
  }

  // 3. Hitung Ulang & Perbarui Saldo Riil Seluruh Akun Keuangan (Semua Toko)
  console.log(`\n==================================================`);
  console.log(`REKALKULASI SALDO AKURAT UNTUK SEMUA DOMPET/AKUN`);
  console.log(`==================================================`);

  const allAccounts = await prisma.financialAccount.findMany({
    include: { store: { select: { name: true } } }
  });

  for (const acc of allAccounts) {
    const inTxs = await prisma.financialTransaction.aggregate({
      where: { accountId: acc.id, type: "INCOME" },
      _sum: { amount: true }
    });

    const outTxs = await prisma.financialTransaction.aggregate({
      where: { accountId: acc.id, type: "EXPENSE" },
      _sum: { amount: true }
    });

    const trfIn = await prisma.financialTransaction.aggregate({
      where: { toAccountId: acc.id, type: "TRANSFER" },
      _sum: { amount: true }
    });

    const trfOut = await prisma.financialTransaction.aggregate({
      where: { accountId: acc.id, type: "TRANSFER" },
      _sum: { amount: true }
    });

    const totalIn = (inTxs._sum.amount || 0) + (trfIn._sum.amount || 0);
    const totalOut = (outTxs._sum.amount || 0) + (trfOut._sum.amount || 0);
    const calculatedBalance = totalIn - totalOut;

    await prisma.financialAccount.update({
      where: { id: acc.id },
      data: { balance: calculatedBalance }
    });

    console.log(`- [${acc.store.name}] ${acc.name} (${acc.type}):`);
    console.log(`    Saldo Sebelumnya: Rp ${acc.balance.toLocaleString("id-ID")}`);
    console.log(`    Saldo Riil Baru : Rp ${calculatedBalance.toLocaleString("id-ID")}`);
  }

  console.log(`\n=== SINKRONISASI BUKU KAS HISTORIS SELESAI DENGAN SUKSES ===`);
}

syncCashflow()
  .catch((e) => {
    console.error("Error executing syncCashflow:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
