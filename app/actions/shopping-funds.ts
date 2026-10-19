"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";

type ActionResponse = { success: boolean; data?: any; error?: string };

/**
 * Mendapatkan data petty cash pegawai, riwayat transfer, dan riwayat belanja.
 */
export async function getShoppingFundsData(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, id: currentUserId, role } = session.user;
    const isAdmin = role === "admin" || role === "super_admin";
    const isSuperAdmin = role === "super_admin";

    // 1. Ambil data User untuk pilihan dropdown dan statistik (khusus admin)
    let usersData: any[] = [];
    if (isAdmin) {
      const dbUsers = await prisma.user.findMany({
        where: { storeId },
        select: { id: true, name: true, role: true }
      });
      usersData = dbUsers;
    } else {
      usersData = [{ id: currentUserId, name: session.user.name, role }];
    }

    // 2. Ambil riwayat allocation (pemberian uang)
    const fundQuery: any = { storeId };
    if (!isAdmin) {
      fundQuery.userId = currentUserId;
    }

    const funds = await prisma.employeeShoppingFund.findMany({
      where: fundQuery,
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // 3. Ambil riwayat pengeluaran (belanja)
    const expenseQuery: any = { storeId };
    if (!isAdmin) {
      expenseQuery.userId = currentUserId;
    }

    const expenses = await prisma.employeeShoppingExpense.findMany({
      where: expenseQuery,
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // 4. Hitung Statistik Per User
    const allStoreFunds = await prisma.employeeShoppingFund.findMany({
      where: { storeId },
      select: { userId: true, amount: true }
    });

    const allStoreExpenses = await prisma.employeeShoppingExpense.findMany({
      where: { storeId },
      select: { userId: true, totalPrice: true }
    });

    const userStats = usersData.map((u) => {
      const userFunds = allStoreFunds
        .filter((f) => f.userId === u.id)
        .reduce((sum, item) => sum + item.amount, 0);

      const userExpenses = allStoreExpenses
        .filter((e) => e.userId === u.id)
        .reduce((sum, item) => sum + item.totalPrice, 0);

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        totalReceived: userFunds,
        totalSpent: userExpenses,
        balance: userFunds - userExpenses
      };
    });

    // Serialisasi data tanggal ke string ISO
    const serializedFunds = funds.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString()
    }));

    const serializedExpenses = expenses.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString()
    }));

    return {
      success: true,
      data: {
        users: usersData,
        funds: serializedFunds,
        expenses: serializedExpenses,
        statistics: userStats,
        currentUser: { id: currentUserId, role, isAdmin, isSuperAdmin }
      }
    };
  } catch (error: any) {
    console.error("getShoppingFundsData error:", error);
    return { success: false, error: "Gagal memuat data keuangan" };
  }
}

/**
 * Memberikan/Mengalokasikan dana operasional belanja ke salah satu pegawai (Hanya Admin & Super Admin)
 */
export async function allocateShoppingFund(data: {
  userId: string;
  amount: number;
  paymentMethod: string;
  evidenceUrl?: string | null;
  notes?: string | null;
}): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId || !["admin", "super_admin"].includes(session.user.role)) {
      return { success: false, error: "Hanya Owner/Admin yang dapat memberikan dana belanja" };
    }

    const { storeId } = session.user;
    const { userId, amount, paymentMethod, evidenceUrl, notes } = data;

    if (!userId) return { success: false, error: "Pilih pegawai penerima dana!" };
    if (!amount || amount <= 0) return { success: false, error: "Nominal pengiriman harus lebih besar dari 0!" };
    if (!["CASH", "TRANSFER"].includes(paymentMethod)) return { success: false, error: "Metode pembayaran tidak valid" };

    const recipient = await prisma.user.findFirst({
      where: { id: userId, storeId }
    });
    if (!recipient) {
      return { success: false, error: "Pegawai penerima tidak valid atau tidak terdaftar di toko ini" };
    }

    // EmployeeShoppingFund tidak punya kolom pemberi dana, jadi log ini
    // satu-satunya catatan siapa yang mengalokasikan.
    await prisma.$transaction(async (tx) => {
      const fund = await tx.employeeShoppingFund.create({
        data: {
          storeId,
          userId,
          amount,
          paymentMethod,
          evidenceUrl,
          notes
        }
      });
      await logActivity(tx, {
        actor: session.user,
        action: "CREATE",
        entityType: "EmployeeShoppingFund",
        entityId: fund.id,
        summary: `Memberikan dana belanja Rp${amount} (${paymentMethod}) ke ${recipient.name}`,
        after: { userId, recipientName: recipient.name, amount, paymentMethod, evidenceUrl, notes },
      });
    });

    revalidatePath("/shopping-funds");
    return { success: true };
  } catch (error: any) {
    console.error("allocateShoppingFund error:", error);
    return { success: false, error: "Gagal mengalokasikan dana" };
  }
}

/**
 * Mencatat pengeluaran/belanja operasional baru yang dilakukan pegawai
 */
export async function createShoppingExpense(data: {
  companyName: string;
  totalPrice: number;
  receiptUrl: string;
  notes?: string | null;
}): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, id: userId } = session.user;
    const { companyName, totalPrice, receiptUrl, notes } = data;

    if (!companyName?.trim()) return { success: false, error: "Nama perusahaan/toko tempat belanja wajib diisi!" };
    if (!totalPrice || totalPrice <= 0) return { success: false, error: "Total pengeluaran tidak valid!" };
    if (!receiptUrl) return { success: false, error: "Bukti foto nota belanja wajib diunggah!" };

    await prisma.$transaction(async (tx) => {
      const expense = await tx.employeeShoppingExpense.create({
        data: {
          storeId,
          userId,
          companyName: companyName.trim(),
          totalPrice,
          receiptUrl,
          notes
        }
      });
      await logActivity(tx, {
        actor: session.user,
        action: "CREATE",
        entityType: "EmployeeShoppingExpense",
        entityId: expense.id,
        summary: `Mencatat belanja di ${expense.companyName} Rp${totalPrice}`,
        after: { companyName: expense.companyName, totalPrice, receiptUrl, notes },
      });
    });

    revalidatePath("/shopping-funds");
    return { success: true };
  } catch (error: any) {
    console.error("createShoppingExpense error:", error);
    return { success: false, error: "Gagal menyimpan laporan belanja" };
  }
}

/**
 * Menghapus transaksi pemberian dana (HANYA SUPER ADMIN)
 */
export async function deleteShoppingFund(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== "super_admin") {
      return { success: false, error: "Hanya Super Admin yang dapat menghapus transaksi pemberian dana!" };
    }

    const fund = await prisma.employeeShoppingFund.findFirst({
      where: { id, storeId: session.user.storeId }
    });

    if (!fund) {
      return { success: false, error: "Data transaksi pemberian dana tidak ditemukan" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeShoppingFund.delete({
        where: { id }
      });
      await logActivity(tx, {
        actor: session.user,
        action: "DELETE",
        entityType: "EmployeeShoppingFund",
        entityId: id,
        summary: `Menghapus pemberian dana belanja Rp${fund.amount} (${fund.paymentMethod})`,
        before: fund,
      });
    });

    revalidatePath("/shopping-funds");
    return { success: true };
  } catch (error: any) {
    console.error("deleteShoppingFund error:", error);
    return { success: false, error: "Gagal menghapus pemberian dana" };
  }
}

/**
 * Menghapus laporan belanja (SUPER ADMIN, ADMIN, atau PEGAWAI PEMBUAT LAPORAN)
 */
export async function deleteShoppingExpense(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, id: currentUserId, role } = session.user;

    const expense = await prisma.employeeShoppingExpense.findFirst({
      where: { id, storeId }
    });

    if (!expense) {
      return { success: false, error: "Data laporan belanja tidak ditemukan" };
    }

    const isSuperAdmin = role === "super_admin";
    const isAdmin = role === "admin";
    const isOwnerOfExpense = expense.userId === currentUserId;

    if (!isSuperAdmin && !isAdmin && !isOwnerOfExpense) {
      return { success: false, error: "Anda tidak berhak menghapus laporan belanja ini!" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeShoppingExpense.delete({
        where: { id }
      });
      await logActivity(tx, {
        actor: session.user,
        action: "DELETE",
        entityType: "EmployeeShoppingExpense",
        entityId: id,
        summary: `Menghapus laporan belanja ${expense.companyName} Rp${expense.totalPrice}`,
        before: expense,
      });
    });

    revalidatePath("/shopping-funds");
    return { success: true };
  } catch (error: any) {
    console.error("deleteShoppingExpense error:", error);
    return { success: false, error: "Gagal menghapus laporan belanja" };
  }
}
