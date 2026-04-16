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
      orderBy: { clockIn: "asc" },
    });

    // Group by User + ShiftType (to keep separate shifts visible, not all merged into one row)
    const grouped = new Map<string, any>();

    for (const log of logs) {
      const key = `${log.userId}_${log.shiftType}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...log, shiftList: [log.shiftType] });
      } else {
        // Update earliest clock-in within same shift
        if (log.clockIn < existing.clockIn) existing.clockIn = log.clockIn;
        // Update latest clock-out within same shift
        if (existing.clockOut !== null && log.clockOut !== null) {
          if (log.clockOut > existing.clockOut) existing.clockOut = log.clockOut;
        } else {
          existing.clockOut = null; // Still active if any entry is open
        }
        if (log.actingAsCashier) existing.actingAsCashier = true;
      }
    }

    const result = Array.from(grouped.values()).sort((a, b) => b.clockIn.getTime() - a.clockIn.getTime());

    return { success: true, data: serialize(result) };
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
    // Group by User + LocalDay + ShiftType (each shift is a separate row)
    const grouped = new Map<string, any>();

    for (const log of logs) {
      const localDay = formatLocalDate(log.clockIn, timezone);
      const key = `${log.userId}_${localDay}_${log.shiftType}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          ...log,
          localDay, // attach local date for future delete reference
          shiftList: [log.shiftType]
        });
      } else {
        // Within the same shift on same day: merge earliest in / latest out
        if (log.clockIn < existing.clockIn) existing.clockIn = log.clockIn;
        if (existing.clockOut !== null && log.clockOut !== null) {
          if (log.clockOut > existing.clockOut) existing.clockOut = log.clockOut;
        } else {
          existing.clockOut = null; // Still active if any is open
        }
        if (log.actingAsCashier) existing.actingAsCashier = true;
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

/**
 * Deletes attendance records for a specific user, date AND shiftType.
 * This way admin can remove a mis-clicked shift without touching correct ones.
 */
export async function deleteAttendanceByUserDay(
  userId: string,
  localDay: string,
  shiftType?: string
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (
      !session?.user?.storeId ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true },
    });
    const timezone = store?.timezone || "Asia/Jakarta";
    const { start, end } = getTZDateRange(new Date(localDay + "T12:00:00"), timezone);

    const whereClause: any = {
      storeId,
      userId,
      clockIn: { gte: start, lte: end },
    };

    // If a specific shiftType is provided, only delete that shift's records
    if (shiftType) {
      whereClause.shiftType = shiftType;
    }

    const result = await prisma.attendance.deleteMany({ where: whereClause });

    revalidatePath("/admin/attendance");
    revalidatePath("/attendance");
    return { success: true, data: { deleted: result.count } };
  } catch (error) {
    console.error("deleteAttendanceByUserDay error:", error);
    return { success: false, error: "Gagal menghapus data absensi" };
  }
}

/**
 * Auto-closes forgotten checkouts based on each shift's autoCheckoutTime setting.
 * Should be called when loading admin attendance page or daily cron.
 */
export async function autoFixMissedCheckouts(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };
    const storeId = session.user.storeId;

    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { timezone: true } });
    const timezone = store?.timezone || "Asia/Jakarta";

    // Get all shift settings that have autoCheckoutTime configured
    const shiftSettings = await prisma.shiftSetting.findMany({
      where: { storeId, autoCheckoutTime: { not: null } }
    });

    if (shiftSettings.length === 0) return { success: true };

    const nowUTC = new Date();
    let fixedCount = 0;

    for (const setting of shiftSettings) {
      if (!setting.autoCheckoutTime) continue;

      // Compute today's autoCheckoutTime in store timezone as UTC
      const localDay = formatLocalDate(nowUTC, timezone);
      const autoCheckoutLocal = `${localDay}T${setting.autoCheckoutTime}:00`;
      const autoCheckoutDate = new Date(autoCheckoutLocal);
      // Adjust for timezone offset
      const tzDate = new Date(autoCheckoutDate.toLocaleString("en-US", { timeZone: timezone }));
      const diff = autoCheckoutDate.getTime() - tzDate.getTime();
      const autoCheckoutUTC = new Date(autoCheckoutDate.getTime() + diff);

      // Only sweep if we've passed the autoCheckoutTime
      if (nowUTC < autoCheckoutUTC) continue;

      // Find open (forgotten) attendances for this shift
      const { start: dayStart } = getTZDateRange(nowUTC, timezone);
      const openLogs = await prisma.attendance.findMany({
        where: {
          storeId,
          shiftType: setting.name,
          clockOut: null,
          clockIn: { gte: dayStart },
        }
      });

      for (const log of openLogs) {
        // Close the attendance at the autoCheckoutTime
        await prisma.attendance.update({
          where: { id: log.id },
          data: { clockOut: autoCheckoutUTC }
        });
        fixedCount++;
      }
    }

    if (fixedCount > 0) revalidatePath("/attendance");
    return { success: true, data: { fixedCount } };
  } catch (error) {
    console.error("autoFixMissedCheckouts error:", error);
    return { success: false, error: "Gagal memperbaiki checkout otomatis" };
  }
}
