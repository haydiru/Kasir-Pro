"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAdmin, isValidRole, safeErrorMessage, UserFacingError, SAFE_USER_SELECT } from "@/lib/auth-guard";
import { logActivity, pickChanges } from "@/lib/activity-log";

type AdminActionState = {
  status: "SUCCESS" | "ERROR";
  message: string;
  timestamp: number;
};

// Middleware-like function to check admin access (role is re-read from the database)
async function checkAdminAccess() {
  return requireAdmin();
}

/**
 * Only a super_admin may create, edit, promote to, or reset the PIN of a super_admin.
 * Prevents a regular admin from taking over the owner account.
 */
function assertCanManageRole(actorRole: string, targetRole: string) {
  if (targetRole === "super_admin" && actorRole !== "super_admin") {
    throw new UserFacingError("Hanya Super Admin yang dapat mengelola akun Super Admin.");
  }
}

export async function createStoreUser(prevState: string | undefined, formData: FormData) {
  try {
    const admin = await checkAdminAccess();
    
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const cycleStartStr = formData.get("cycleStart") as string;
    const cycleEndStr = formData.get("cycleEnd") as string;
    
    // Default PIN is 123456
    const defaultPin = "123456";
    const hashedPin = await bcrypt.hash(defaultPin, 10);

    // Validate inputs
    if (!name || !email || !role || !cycleStartStr || !cycleEndStr) {
      return "Mohon lengkapi semua bidang.";
    }

    if (!isValidRole(role)) {
      return "Role pengguna tidak valid.";
    }
    assertCanManageRole(admin.role, role);

    const payrollCycleStart = parseInt(cycleStartStr);
    const payrollCycleEnd = parseInt(cycleEndStr);

    if (isNaN(payrollCycleStart) || isNaN(payrollCycleEnd)) {
      return "Siklus gaji tidak valid.";
    }

    // Checking email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return "Email sudah terdaftar di sistem.";
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          storeId: admin.storeId,
          name,
          email,
          role,
          pin: hashedPin,
          payrollCycleStart,
          payrollCycleEnd,
        }
      });
      await logActivity(tx, {
        actor: admin,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        summary: `Menambah pengguna ${name} (${role})`,
        after: { name, email, role, payrollCycleStart, payrollCycleEnd },
      });
    });

    revalidatePath("/admin/users");
    return "SUCCESS";
  } catch (error: any) {
    console.error("Create User Error:", error);
    return `Gagal membuat pengguna: ${safeErrorMessage(error, "Terjadi kesalahan sistem.")}`;
  }
}

export async function updateStoreUser(prevState: string | undefined, formData: FormData) {
  try {
    const admin = await checkAdminAccess();
    
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const cycleStartStr = formData.get("cycleStart") as string;
    const cycleEndStr = formData.get("cycleEnd") as string;

    if (!id || !name || !email || !role || !cycleStartStr || !cycleEndStr) {
      return "Mohon lengkapi semua bidang.";
    }

    if (!isValidRole(role)) {
      return "Role pengguna tidak valid.";
    }

    // Verify user belongs to the same store
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.storeId !== admin.storeId) {
      return "Pengguna tidak ditemukan atau Anda tidak memiliki akses.";
    }

    // Admins cannot edit a super_admin account nor promote anyone to super_admin
    assertCanManageRole(admin.role, user.role);
    assertCanManageRole(admin.role, role);

    // Never leave a store without a super_admin
    if (user.role === "super_admin" && role !== "super_admin") {
      const otherSuperAdmins = await prisma.user.count({
        where: { storeId: admin.storeId, role: "super_admin", id: { not: id } },
      });
      if (otherSuperAdmins === 0) {
        return "Toko harus memiliki minimal satu Super Admin.";
      }
    }

    // Email change must not collide with another account
    if (email !== user.email) {
      const emailOwner = await prisma.user.findUnique({ where: { email } });
      if (emailOwner) return "Email sudah terdaftar di sistem.";
    }

    const updateData = {
      name,
      email,
      role,
      payrollCycleStart: parseInt(cycleStartStr),
      payrollCycleEnd: parseInt(cycleEndStr),
    };
    const diff = pickChanges(user, updateData);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: updateData,
      });
      if (diff.changed.length > 0) {
        await logActivity(tx, {
          actor: admin,
          action: user.role !== role ? "ROLE_CHANGE" : "UPDATE",
          entityType: "User",
          entityId: id,
          summary: user.role !== role
            ? `Mengubah role ${user.name}: ${user.role} → ${role}`
            : `Mengubah data pengguna ${user.name} (${diff.changed.join(", ")})`,
          before: diff.before,
          after: diff.after,
        });
      }
    });

    revalidatePath("/admin/users");
    return "SUCCESS";
  } catch (error: any) {
    return `Gagal mengedit pengguna: ${safeErrorMessage(error, "Terjadi kesalahan sistem.")}`;
  }
}

export async function verifyShiftReport(prevState: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  try {
    const admin = await checkAdminAccess();
    
    const reportId = formData.get("reportId") as string;
    const adminVarianceStr = formData.get("variance") as string;
    const adminNotes = formData.get("notes") as string;

    if (!reportId) {
      return {
        status: "ERROR",
        message: "ID Laporan tidak valid.",
        timestamp: Date.now(),
      };
    }

    const variance = parseFloat(adminVarianceStr);

    const report = await prisma.shiftReport.findUnique({
      where: { id: reportId },
      include: {
        user: { select: SAFE_USER_SELECT },
        digitalTransactions: true,
        expenditures: true,
      }
    });

    if (!report || report.storeId !== admin.storeId) {
      return {
        status: "ERROR",
        message: "Laporan tidak ditemukan atau Anda tidak memiliki akses.",
        timestamp: Date.now(),
      };
    }

    await prisma.$transaction(async (tx) => {
      const verifiedData = {
        status: "Verified",
        verifiedById: admin.id,
        finalAdminVariance: isNaN(variance) ? 0 : variance,
        adminNotes,
        verifiedAt: new Date(),
      };
      await tx.shiftReport.update({
        where: { id: reportId },
        data: verifiedData,
      });

      await logActivity(tx, {
        actor: admin,
        action: "VERIFY",
        entityType: "ShiftReport",
        entityId: reportId,
        summary: `Verifikasi laporan ${report.shiftType} ${report.date.toISOString().split("T")[0]} milik ${report.user.name}`,
        before: {
          status: report.status,
          verifiedById: report.verifiedById,
          finalAdminVariance: report.finalAdminVariance,
          adminNotes: report.adminNotes,
        },
        after: {
          ...verifiedData,
          posCash: report.posCash,
          posDebit: report.posDebit,
          manualCashCount: report.manualCashCount,
          startingCash: report.startingCash,
        },
      });

      // 1. Akun Kas Pegangan Admin (CASH_ADMIN) - hanya memegang uang cash fisik
      let adminAccount = await tx.financialAccount.findFirst({
        where: { storeId: admin.storeId, userId: admin.id, type: "CASH_ADMIN" }
      });

      if (!adminAccount) {
        if (!admin.name || !admin.id) throw new UserFacingError("Info admin tidak lengkap.");
        adminAccount = await tx.financialAccount.create({
          data: {
            storeId: admin.storeId,
            userId: admin.id,
            name: `Kas Pegangan ${admin.name}`,
            type: "CASH_ADMIN",
            balance: 0,
          }
        });
      }

      // 2. Akun Rekening Bank Perusahaan (BANK_STORE) - menampung transfer & debit
      let bankAccount = await tx.financialAccount.findFirst({
        where: { storeId: admin.storeId, type: "BANK_STORE" }
      });

      if (!bankAccount) {
        bankAccount = await tx.financialAccount.create({
          data: {
            storeId: admin.storeId,
            name: "Rekening Bank Utama",
            type: "BANK_STORE",
            balance: 0,
          }
        });
      }

      // 3. Rollback transaksi lama jika sudah pernah tercatat (idempotent / reverify safe)
      const existingTxs = await tx.financialTransaction.findMany({
        where: { shiftReportId: report.id }
      });

      for (const et of existingTxs) {
        if (et.type === "INCOME") {
          await tx.financialAccount.update({
            where: { id: et.accountId },
            data: { balance: { decrement: et.amount } }
          });
        } else if (et.type === "EXPENSE") {
          await tx.financialAccount.update({
            where: { id: et.accountId },
            data: { balance: { increment: et.amount } }
          });
        }
      }

      if (existingTxs.length > 0) {
        await tx.financialTransaction.deleteMany({
          where: { shiftReportId: report.id }
        });
      }

      const reportDateStr = report.date.toISOString().split("T")[0];

      // 4. Catat Setoran Cash Fisik ke Kas Pegangan Admin yang memverifikasi
      if (report.manualCashCount > 0) {
        await tx.financialTransaction.create({
          data: {
            storeId: admin.storeId,
            accountId: adminAccount.id,
            userId: admin.id,
            type: "INCOME",
            category: "Setoran Shift",
            amount: report.manualCashCount,
            description: `Setoran shift ${report.shiftType} (Tunai Fisik) dari ${report.user.name} (${reportDateStr})`,
            shiftReportId: report.id
          }
        });

        await tx.financialAccount.update({
          where: { id: adminAccount.id },
          data: { balance: { increment: report.manualCashCount } }
        });
      }

      // 5. Catat Omzet POS Debit / QRIS ke Rekening Bank Perusahaan
      if (report.posDebit > 0) {
        await tx.financialTransaction.create({
          data: {
            storeId: admin.storeId,
            accountId: bankAccount.id,
            userId: admin.id,
            type: "INCOME",
            category: "Setoran Shift (Debit / QRIS)",
            amount: report.posDebit,
            description: `Omzet POS Debit/QRIS shift ${report.shiftType} dari ${report.user.name} (${reportDateStr})`,
            shiftReportId: report.id
          }
        });

        await tx.financialAccount.update({
          where: { id: bankAccount.id },
          data: { balance: { increment: report.posDebit } }
        });
      }

      // 6. Catat Transaksi Digital Non-Tunai / Transfer ke Rekening Bank Perusahaan
      const nonCashDigital = (report.digitalTransactions || [])
        .filter((d: any) => d.isNonCash)
        .reduce((sum: number, d: any) => sum + (d.grossAmount || 0), 0);

      if (nonCashDigital > 0) {
        await tx.financialTransaction.create({
          data: {
            storeId: admin.storeId,
            accountId: bankAccount.id,
            userId: admin.id,
            type: "INCOME",
            category: "Transaksi Digital (Transfer)",
            amount: nonCashDigital,
            description: `Layanan digital transfer/non-tunai shift ${report.shiftType} (${reportDateStr})`,
            shiftReportId: report.id
          }
        });

        await tx.financialAccount.update({
          where: { id: bankAccount.id },
          data: { balance: { increment: nonCashDigital } }
        });
      }

      // 7. Catat Pengeluaran Supplier yang Dibayar Transfer Bank dari Rekening Perusahaan
      const transferExpenditures = (report.expenditures || []).filter((e: any) => (e.amountFromTransfer || 0) > 0);
      const totalTransferExpense = transferExpenditures.reduce((sum: number, e: any) => sum + (e.amountFromTransfer || 0), 0);

      if (totalTransferExpense > 0) {
        const suppliersList = transferExpenditures.map((e: any) => e.supplierName).filter(Boolean).join(", ");
        await tx.financialTransaction.create({
          data: {
            storeId: admin.storeId,
            accountId: bankAccount.id,
            userId: admin.id,
            type: "EXPENSE",
            category: "Tagihan",
            amount: totalTransferExpense,
            description: `Pengeluaran transfer bank shift ${report.shiftType}: ${suppliersList || "Supplier"} (${reportDateStr})`,
            shiftReportId: report.id
          }
        });

        await tx.financialAccount.update({
          where: { id: bankAccount.id },
          data: { balance: { decrement: totalTransferExpense } }
        });
      }

      // 8. Trigger Notification jika ada catatan admin
      if (adminNotes && adminNotes.trim().length > 0) {
        const reportDate = report.date.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        await tx.notification.create({
          data: {
            userId: report.userId,
            title: "Catatan Verifikasi Baru",
            message: `Admin memberikan catatan pada laporan ${report.shiftType} tanggal ${reportDate}: "${adminNotes.slice(0, 50)}${adminNotes.length > 50 ? '...' : ''}"`,
            type: "ADMIN_NOTE",
            link: "/cashier/history"
          }
        });
      }
    });

    revalidatePath("/admin/verifications");
    revalidatePath("/admin/cashflow");
    revalidatePath("/admin/dashboard");
    return {
      status: "SUCCESS",
      message: "Laporan berhasil diverifikasi.",
      timestamp: Date.now(),
    };
  } catch (error: any) {
    return {
      status: "ERROR",
      message: `Gagal memverifikasi: ${safeErrorMessage(error, "Terjadi kesalahan sistem.")}`,
      timestamp: Date.now(),
    };
  }
}

export async function unverifyShiftReport(prevState: AdminActionState | undefined, formData: FormData): Promise<AdminActionState> {
  try {
    const admin = await checkAdminAccess();
    const reportId = formData.get("reportId") as string;

    if (!reportId) {
      return {
        status: "ERROR",
        message: "ID Laporan tidak valid.",
        timestamp: Date.now(),
      };
    }

    const report = await prisma.shiftReport.findUnique({ where: { id: reportId } });
    if (!report || report.storeId !== admin.storeId) {
      return {
        status: "ERROR",
        message: "Laporan tidak ditemukan atau Anda tidak memiliki akses.",
        timestamp: Date.now(),
      };
    }

    await prisma.$transaction(async (tx) => {
      const existingTxs = await tx.financialTransaction.findMany({
        where: { shiftReportId: report.id }
      });

      for (const existingTx of existingTxs) {
        if (existingTx.type === "INCOME") {
          await tx.financialAccount.update({
            where: { id: existingTx.accountId },
            data: { balance: { decrement: existingTx.amount } }
          });
        } else if (existingTx.type === "EXPENSE") {
          await tx.financialAccount.update({
            where: { id: existingTx.accountId },
            data: { balance: { increment: existingTx.amount } }
          });
        }
      }

      await tx.financialTransaction.deleteMany({
        where: { shiftReportId: report.id }
      });

      await tx.shiftReport.update({
        where: { id: reportId },
        data: {
          status: "Submitted",
          verifiedById: null,
          finalAdminVariance: null,
          verifiedAt: null,
          adminNotes: null,
        }
      });

      // Simpan siapa verifikator sebelumnya & transaksi kas yang dibatalkan,
      // karena kolom-kolom itu dikosongkan di ShiftReport.
      await logActivity(tx, {
        actor: admin,
        action: "UNVERIFY",
        entityType: "ShiftReport",
        entityId: reportId,
        summary: `Membatalkan verifikasi laporan ${report.shiftType} ${report.date.toISOString().split("T")[0]}`,
        before: {
          status: report.status,
          verifiedById: report.verifiedById,
          verifiedAt: report.verifiedAt,
          finalAdminVariance: report.finalAdminVariance,
          adminNotes: report.adminNotes,
          financialTransactions: existingTxs,
        },
        after: { status: "Submitted" },
      });
    });

    revalidatePath("/admin/verifications");
    revalidatePath("/admin/cashflow");
    revalidatePath("/admin/dashboard");
    return {
      status: "SUCCESS",
      message: "Verifikasi laporan dibatalkan.",
      timestamp: Date.now(),
    };
  } catch (error: any) {
    return {
      status: "ERROR",
      message: `Gagal membatalkan verifikasi: ${safeErrorMessage(error, "Terjadi kesalahan sistem.")}`,
      timestamp: Date.now(),
    };
  }
}

export async function resetUserPin(userId: string) {
  try {
    const admin = await checkAdminAccess();
    
    // Verify ownership
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.storeId !== admin.storeId) {
      return { success: false, message: "Akses ditolak." };
    }
    assertCanManageRole(admin.role, user.role);

    const hashedPin = await bcrypt.hash("123456", 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { pin: hashedPin }
      });
      await logActivity(tx, {
        actor: admin,
        action: "PIN_RESET",
        entityType: "User",
        entityId: userId,
        summary: `Reset PIN ${user.name} ke PIN default`,
      });
    });

    return { success: true, message: "PIN berhasil direset ke 123456." };
  } catch (error: any) {
    return { success: false, message: safeErrorMessage(error, "Gagal mereset PIN.") };
  }
}

export async function getStoreEmployeesShort() {
  try {
    const admin = await checkAdminAccess();
    const users = await prisma.user.findMany({
      where: { storeId: admin.storeId },
      select: {
        id: true,
        name: true,
        role: true
      },
      orderBy: { name: "asc" }
    });
    return { success: true, data: users };
  } catch (error) {
    return { success: false, error: "Gagal memuat daftar pegawai" };
  }
}
