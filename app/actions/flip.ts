"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serialize, ActionResponse } from "@/lib/serialize";
import { revalidatePath } from "next/cache";
import { getTZMonthRange, getTZDateRange, getTZShiftRange } from "@/lib/utils";
import crypto from "crypto";

/**
 * Get all Flip transactions for the store in a given month/year.
 */
export async function getFlipTransactions(
  month: number,
  year: number
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

    const { start, end } = getTZMonthRange(year, month, timezone);

    const transactions = await prisma.flipWebhook.findMany({
      where: {
        storeId,
        transactionTime: { gte: start, lte: end },
      },
      orderBy: { transactionTime: "desc" },
    });

    // Dynamically compute matched status for the current page's transactions only
    const dbFlipIds = transactions.map(t => t.flipId).filter(Boolean);
    let usedSet = new Set<string>();

    if (dbFlipIds.length > 0) {
      const searchFlipIds = dbFlipIds.flatMap(id => [id, `#${id}`]);
      const usedDigitalTxs = await prisma.digitalTransaction.findMany({
        where: {
          flipId: { in: searchFlipIds },
          report: { storeId },
        },
        select: { flipId: true },
      });
      usedSet = new Set(
        usedDigitalTxs
          .map(dt => (dt.flipId?.replace(/^#/, "") || "").trim().toUpperCase())
          .filter(Boolean)
      );
    }

    const resolvedTransactions = transactions.map(t => {
      const cleanId = (t.flipId?.replace(/^#/, "") || "").trim().toUpperCase();
      return {
        ...t,
        matched: usedSet.has(cleanId)
      };
    });

    return { success: true, data: serialize(resolvedTransactions) };
  } catch (error) {
    console.error("getFlipTransactions error:", error);
    return { success: false, error: "Gagal mengambil data transaksi Flip" };
  }
}

/**
 * Toggle exclude status for a Flip transaction.
 * Excluded = admin marks it as "not a cashier transaction".
 */
export async function toggleFlipExcluded(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (
      !session?.user?.storeId ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const record = await prisma.flipWebhook.findUnique({ where: { id } });
    if (!record || record.storeId !== session.user.storeId) {
      return { success: false, error: "Not found" };
    }

    const updated = await prisma.flipWebhook.update({
      where: { id },
      data: { excluded: !record.excluded },
    });

    revalidatePath("/admin/flip-transactions");
    return { success: true, data: serialize(updated) };
  } catch (error) {
    console.error("toggleFlipExcluded error:", error);
    return { success: false, error: "Gagal mengubah status exclude" };
  }
}

/**
 * Get unmatched Flip transactions for a specific report.
 * Returns Flip emails that:
 *   1. Fall within the exact shift hours (Shift Pagi / Siang / Malam / Custom)
 *   2. Are not excluded by admin
 *   3. Are NOT already reported in any OTHER shift report (no duplicate reporting)
 *   4. Their flipId does NOT match any digitalTransaction.flipId in this current report
 */
export async function getUnmatchedFlipForReport(
  reportId: string
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }

    const report = await prisma.shiftReport.findUnique({
      where: { id: reportId },
      include: {
        digitalTransactions: { select: { flipId: true } },
        store: { 
          select: { 
            timezone: true,
            shiftSettings: { select: { name: true, startTime: true, endTime: true } }
          } 
        },
      },
    });

    if (!report || report.storeId !== session.user.storeId) {
      return { success: false, error: "Report not found" };
    }

    const timezone = report.store?.timezone || "Asia/Jakarta";
    
    // 1. Calculate the exact shift time range
    const shiftRange = getTZShiftRange(
      report.date,
      report.shiftType,
      timezone,
      report.store?.shiftSettings
    );

    const shiftStart = shiftRange.start;
    // Allow up to report submission time or shift end time
    const shiftEnd = report.submittedAt
      ? new Date(Math.max(new Date(report.submittedAt).getTime(), shiftRange.end.getTime()))
      : shiftRange.end;

    // 2. Fetch all Flip transactions within the shift time window
    const flipTxs = await prisma.flipWebhook.findMany({
      where: {
        storeId: report.storeId,
        excluded: false,
        transactionTime: { gte: shiftStart, lte: shiftEnd },
      },
      orderBy: { transactionTime: "desc" },
    });

    // 3. Find all flipIds ALREADY recorded in OTHER shift reports of this store
    const otherDigitalTxs = await prisma.digitalTransaction.findMany({
      where: {
        report: { storeId: report.storeId },
        reportId: { not: report.id },
        flipId: { not: null },
      },
      select: { flipId: true },
    });

    const usedInOtherReports = new Set(
      otherDigitalTxs
        .map((dt) => (dt.flipId?.replace(/^#/, "") || "").trim().toUpperCase())
        .filter(Boolean)
    );

    // 4. Current report's recorded flipIds
    const currentReportFlipIds = new Set(
      report.digitalTransactions
        .map((dt) => (dt.flipId?.replace(/^#/, "") || "").trim().toUpperCase())
        .filter(Boolean)
    );

    // 5. Unmatched = strictly in shift range, NOT in other reports, and NOT in current report
    const unmatched = flipTxs.filter((ft) => {
      const cleanId = (ft.flipId?.replace(/^#/, "") || "").trim().toUpperCase();
      // If already recorded in another shift, do NOT flag as missing here
      if (usedInOtherReports.has(cleanId)) return false;
      // If not yet entered in current report, flag as missing
      return !currentReportFlipIds.has(cleanId);
    });

    // 6. Update matched flag in DB for transactions used in the current report
    const matchedIds = flipTxs
      .filter((ft) => currentReportFlipIds.has((ft.flipId?.replace(/^#/, "") || "").trim().toUpperCase()))
      .map((ft) => ft.id);

    if (matchedIds.length > 0) {
      await prisma.flipWebhook.updateMany({
        where: { id: { in: matchedIds } },
        data: { matched: true },
      });
    }

    return { success: true, data: serialize(unmatched) };
  } catch (error) {
    console.error("getUnmatchedFlipForReport error:", error);
    return { success: false, error: "Gagal mengambil data unmatched Flip" };
  }
}

/**
 * Generate or regenerate the Flip API key for the store.
 */
export async function generateFlipApiKey(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (
      !session?.user?.storeId ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const newKey = "flip_" + crypto.randomBytes(24).toString("hex");

    await prisma.store.update({
      where: { id: session.user.storeId },
      data: { flipApiKey: newKey },
    });

    revalidatePath("/admin/store-settings");
    return { success: true, data: { apiKey: newKey } };
  } catch (error) {
    console.error("generateFlipApiKey error:", error);
    return { success: false, error: "Gagal generate API key" };
  }
}

/**
 * Get the current Flip API key for the store.
 */
export async function getFlipApiKey(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (
      !session?.user?.storeId ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return { success: false, error: "Unauthorized" };
    }

    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId },
      select: { id: true, flipApiKey: true },
    });

    return {
      success: true,
      data: { apiKey: store?.flipApiKey || null, storeId: store?.id },
    };
  } catch (error) {
    console.error("getFlipApiKey error:", error);
    return { success: false, error: "Gagal mengambil API key" };
  }
}

/**
 * Delete a single Flip transaction (Super Admin only).
 */
export async function deleteFlipTransaction(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (
      !session?.user?.storeId ||
      session.user.role !== "super_admin"
    ) {
      return { success: false, error: "Hanya Super Admin yang berhak menghapus transaksi Flip." };
    }

    const res = await prisma.flipWebhook.deleteMany({
      where: {
        id,
        storeId: session.user.storeId,
      },
    });

    if (res.count === 0) {
      return { success: false, error: "Transaksi tidak ditemukan." };
    }

    return { success: true, data: { id } };
  } catch (error) {
    console.error("deleteFlipTransaction error:", error);
    return { success: false, error: "Gagal menghapus transaksi Flip." };
  }
}

/**
 * Bulk delete Flip transactions (Super Admin only).
 */
export async function bulkDeleteFlipTransactions(ids: string[]): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (
      !session?.user?.storeId ||
      session.user.role !== "super_admin"
    ) {
      return { success: false, error: "Hanya Super Admin yang berhak menghapus transaksi Flip." };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "Tidak ada transaksi yang dipilih." };
    }

    const result = await prisma.flipWebhook.deleteMany({
      where: {
        id: { in: ids },
        storeId: session.user.storeId,
      },
    });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    console.error("bulkDeleteFlipTransactions error:", error);
    return { success: false, error: "Gagal menghapus transaksi Flip massal." };
  }
}
