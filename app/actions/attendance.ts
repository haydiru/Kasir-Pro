"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize, ActionResponse } from "@/lib/serialize";
import { getTZDateRange, getTZMonthRange, formatLocalDate } from "@/lib/utils";

export async function getActiveAttendance(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        clockOut: null,
      },
      orderBy: { clockIn: "desc" },
    });

    return { 
      success: true, 
      data: serialize(attendance) 
    };
  } catch (error: any) {
    console.error("getActiveAttendance error:", error);
    return { success: false, error: error.message || "Gagal mengambil data presensi aktif" };
  }
}

export async function checkIn(data: { shiftType: string; actingAsCashier: boolean }): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const existingRes = await getActiveAttendance();
    if (existingRes.success && existingRes.data) {
      return { success: false, error: "Sudah ada presensi aktif" };
    }

    const attendance = await prisma.attendance.create({
      data: {
        userId: session.user.id,
        storeId: session.user.storeId,
        shiftType: data.shiftType,
        actingAsCashier: data.actingAsCashier,
        clockIn: new Date(),
      },
    });

    revalidatePath("/attendance");
    return { 
      success: true, 
      data: serialize(attendance) 
    };
  } catch (error: any) {
    console.error("checkIn error:", error);
    return { success: false, error: error.message || "Gagal melakukan clock-in" };
  }
}

export async function clockOut(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        clockOut: new Date(),
      },
    });

    revalidatePath("/attendance");
    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("clockOut error:", error);
    return { success: false, error: "Gagal melakukan clock-out" };
  }
}

export async function getTodayAttendanceLog(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: true, data: [] };

    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    const { start: todayStart } = getTZDateRange(new Date(), timezone);

    const logs = await prisma.attendance.findMany({
      where: {
        storeId: session.user.storeId,
        clockIn: {
          gte: todayStart,
        },
      },
      include: {
        user: true,
      },
      orderBy: { clockIn: "asc" }, // Ascending so we process chronologically
    });

    // Aggregate by user + shift
    const grouped = new Map<string, any>();

    for (const log of logs) {
      const key = log.userId;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
            ...log,
            shiftList: [log.shiftType]
        });
      } else {
        // Concatenate unique shift names
        if (!existing.shiftList.includes(log.shiftType)) {
            existing.shiftList.push(log.shiftType);
            existing.shiftType = existing.shiftList.join(", ");
        }

        // Update first clock-in
        if (log.clockIn < existing.clockIn) {
            existing.clockIn = log.clockIn;
        }
        
        // Update last clock-out
        if (existing.clockOut === null || log.clockOut === null) {
            existing.clockOut = null;
        } else if (log.clockOut > existing.clockOut) {
            existing.clockOut = log.clockOut;
        }
      }
    }

    // Convert back to array and sort descending by clockIn for UI
    const result = Array.from(grouped.values()).sort((a, b) => b.clockIn.getTime() - a.clockIn.getTime());

    return { 
      success: true, 
      data: serialize(result) 
    };
  } catch (error: any) {
    console.error("getTodayAttendanceLog error:", error);
    return { success: false, error: "Gagal mengambil log presensi hari ini" };
  }
}
export async function deleteAttendanceLogs(userId: string, dateStr: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
      return { success: false, error: "Unauthorized" };
    }

    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    const date = new Date(dateStr);
    const { start, end } = getTZDateRange(date, timezone);

    await prisma.attendance.deleteMany({
      where: {
        userId,
        clockIn: {
          gte: start,
          lte: end,
        },
      },
    });

    revalidatePath("/attendance");
    return { success: true };
  } catch (error: any) {
    console.error("deleteAttendanceLogs error:", error);
    return { success: false, error: "Gagal menghapus log presensi" };
  }
}

export async function getMyAttendanceHistory() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const logs = await prisma.attendance.findMany({
      where: { userId: session.user.id },
      orderBy: { clockIn: "desc" },
      take: 50, // Last 50 entries
    });

    return { success: true, data: serialize(logs) };
  } catch (error) {
    return { success: false, error: "Gagal memuat riwayat" };
  }
}

export async function getAdminAttendanceHistory(filters: { userId?: string, date?: string, month?: number, year?: number }) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
      throw new Error("Unauthorized");
    }

    const storeId = session.user.storeId;
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    let whereClause: any = { storeId };

    if (filters.userId && filters.userId !== "all") {
      whereClause.userId = filters.userId;
    }

    if (filters.month && filters.year) {
      const { start, end } = getTZMonthRange(filters.year, filters.month, timezone);
      whereClause.clockIn = {
        gte: start,
        lte: end,
      };
    } else if (filters.date) {
      const { start, end } = getTZDateRange(new Date(filters.date), timezone);
      whereClause.clockIn = {
        gte: start,
        lte: end,
      };
    }

    const logs = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            role: true
          }
        }
      },
      orderBy: { clockIn: "asc" } // Sort asc to process earliest entries first
    });

    // Aggregate by user + day
    const grouped = new Map<string, any>();

    for (const log of logs) {
      const localDay = formatLocalDate(log.clockIn, timezone);
      const key = `${log.userId}_${localDay}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
            ...log,
            shiftList: [log.shiftType]
        });
      } else {
        // Concatenate unique shift names
        if (!existing.shiftList.includes(log.shiftType)) {
            existing.shiftList.push(log.shiftType);
            existing.shiftType = existing.shiftList.join(", ");
        }

        // Update first clock-in (earliest)
        if (log.clockIn < existing.clockIn) {
            existing.clockIn = log.clockIn;
        }
        
        // Update last clock-out (latest)
        if (existing.clockOut === null || log.clockOut === null) {
            existing.clockOut = null;
        } else if (log.clockOut > existing.clockOut) {
            existing.clockOut = log.clockOut;
        }

        // Update actingAsCashier (true if any)
        if (log.actingAsCashier) {
            existing.actingAsCashier = true;
        }
      }
    }

    // Convert back to array and sort descending by clockIn for UI
    const aggregatedLogs = Array.from(grouped.values()).sort((a, b) => b.clockIn.getTime() - a.clockIn.getTime());

    const shiftSettings = await prisma.shiftSetting.findMany({
      where: { storeId },
      orderBy: { startTime: "asc" }
    });

    return { 
      success: true, 
      data: {
        logs: serialize(aggregatedLogs),
        shiftSettings: serialize(shiftSettings)
      } 
    };
  } catch (error) {
    console.error("getAdminAttendanceHistory error:", error);
    return { success: false, error: "Gagal mengambil riwayat absensi admin" };
  }
}
