"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type ActionResponse = { success: boolean; data?: any; error?: string };

/**
 * Pastikan Akun Default Tersedia (Dijalankan saat masuk dashboard)
 * Menjamin toko punya 1 "BANK_STORE" dan si Admin punya 1 "CASH_ADMIN".
 */
export async function ensureFinancialAccounts(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId || !["admin", "super_admin"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, id: userId, name: userName } = session.user;

    // Pastikan Rekening Bank Utama ada
    const bankAccount = await prisma.financialAccount.findFirst({
      where: { storeId, type: "BANK_STORE" }
    });

    if (!bankAccount) {
      await prisma.financialAccount.create({
        data: {
          storeId,
          name: "Rekening Bank Utama",
          type: "BANK_STORE",
          balance: 0,
        }
      });
    }

    // Pastikan Kas Pegangan Admin (user spesifik) ada
    const adminCashAccount = await prisma.financialAccount.findFirst({
      where: { storeId, userId, type: "CASH_ADMIN" }
    });

    if (!adminCashAccount) {
      await prisma.financialAccount.create({
        data: {
          storeId,
          userId,
          name: `Kas Pegangan ${userName}`,
          type: "CASH_ADMIN",
          balance: 0,
        }
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("ensureFinancialAccounts Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Mencatat Transaksi Baru (In, Out, Transfer)
 */
export async function createFinancialTransaction(data: {
  accountId: string;
  toAccountId?: string | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string;
  amount: number;
  description?: string;
  receiptUrl?: string;
}): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId || !["admin", "super_admin"].includes(session.user.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, id: userId } = session.user;
    const { accountId, toAccountId, type, category, amount, description, receiptUrl } = data;

    if (amount <= 0) return { success: false, error: "Nominal harus lebih dari 0" };

    // Validasi akun sumber
    const account = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    if (!account || account.storeId !== storeId) return { success: false, error: "Akun asal tidak valid" };

    // Transaction logic
    await prisma.$transaction(async (tx) => {
      // Buat riwayat mutasi
      await tx.financialTransaction.create({
        data: {
          storeId,
          accountId,
          toAccountId,
          userId,
          type,
          category,
          amount,
          description,
          receiptUrl
        }
      });

      // Update Saldo
      if (type === "INCOME") {
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { increment: amount } }
        });
      } else if (type === "EXPENSE") {
        if (account.balance < amount) throw new Error(`Saldo ${account.name} tidak mencukupi (Sisa: ${account.balance})`);
        
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: amount } }
        });
      } else if (type === "TRANSFER" && toAccountId) {
        if (account.balance < amount) throw new Error(`Saldo ${account.name} tidak mencukupi (Sisa: ${account.balance})`);
        
        const targetAccount = await tx.financialAccount.findUnique({ where: { id: toAccountId } });
        if (!targetAccount || targetAccount.storeId !== storeId) throw new Error("Akun tujuan tidak valid");

        // Kurangi dari sumber
        await tx.financialAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: amount } }
        });

        // Tambah ke tujuan
        await tx.financialAccount.update({
          where: { id: toAccountId },
          data: { balance: { increment: amount } }
        });
      }
    });

    revalidatePath("/admin/cashflow");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("createFinancialTransaction Error:", error);
    return { success: false, error: error.message || "Gagal mencatat transaksi" };
  }
}

/**
 * Get Data Keuangan Dashboard
 */
export async function getCashflowData() {
  try {
    const session = await auth();
    if (!session?.user?.storeId || !["admin", "super_admin"].includes(session.user.role)) {
      throw new Error("Unauthorized");
    }

    const { storeId } = session.user;

    // Ambil daftar dompet
    const accounts = await prisma.financialAccount.findMany({
      where: { storeId },
      include: { user: { select: { name: true } } },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });

    // Ambil history transaksi 100 terakhir (bisa pagination nanti)
    const transactions = await prisma.financialTransaction.findMany({
      where: { storeId },
      include: {
        account: { select: { name: true, type: true } },
        toAccount: { select: { name: true, type: true } },
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    // Serialisasi
    const serializedAccounts = accounts.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    const serializedTransactions = transactions.map(t => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      date: t.date.toISOString(),
    }));

    return { success: true, accounts: serializedAccounts, transactions: serializedTransactions };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
