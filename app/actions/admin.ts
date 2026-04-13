"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// Middleware-like function to check admin access
async function checkAdminAccess() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  
  const role = session.user.role;
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Forbidden: Requires Admin privileges");
  }
  
  return session.user;
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

    await prisma.user.create({
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

    revalidatePath("/admin/users");
    return "SUCCESS";
  } catch (error: any) {
    console.error("Create User Error:", error);
    return `Gagal membuat pengguna: ${error.message}`;
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

    // Verify user belongs to the same store
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.storeId !== admin.storeId) {
      return "Pengguna tidak ditemukan atau Anda tidak memiliki akses.";
    }

    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        payrollCycleStart: parseInt(cycleStartStr),
        payrollCycleEnd: parseInt(cycleEndStr),
      }
    });

    revalidatePath("/admin/users");
    return "SUCCESS";
  } catch (error: any) {
    return `Gagal mengedit pengguna: ${error.message}`;
  }
}

export async function verifyShiftReport(prevState: string | undefined, formData: FormData) {
  try {
    const admin = await checkAdminAccess();
    
    const reportId = formData.get("reportId") as string;
    const adminVarianceStr = formData.get("variance") as string;
    const adminNotes = formData.get("notes") as string;

    if (!reportId) return "ID Laporan tidak valid.";

    const variance = parseFloat(adminVarianceStr);

    const report = await prisma.shiftReport.findUnique({
      where: { id: reportId }
    });

    if (!report || report.storeId !== admin.storeId) {
      return "Laporan tidak ditemukan atau Anda tidak memiliki akses.";
    }

    await prisma.shiftReport.update({
      where: { id: reportId },
      data: {
        status: "Verified",
        finalAdminVariance: isNaN(variance) ? 0 : variance,
        adminNotes,
        verifiedAt: new Date(),
      }
    });

    revalidatePath("/admin/verifications");
    return "SUCCESS";
  } catch (error: any) {
    return `Gagal memverifikasi: ${error.message}`;
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

    const hashedPin = await bcrypt.hash("123456", 10);
    await prisma.user.update({
      where: { id: userId },
      data: { pin: hashedPin }
    });

    return { success: true, message: "PIN berhasil direset ke 123456." };
  } catch (error: any) {
    return { success: false, message: error.message };
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
