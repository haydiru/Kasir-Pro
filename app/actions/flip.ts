"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serialize, ActionResponse } from "@/lib/serialize";
import { revalidatePath } from "next/cache";
import { getTZMonthRange, getTZDateRange } from "@/lib/utils";
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

    // Dynamically compute matched status based on whether it exists in any report
    const dbFlipIds = transactions.map(t => t.flipId).filter(Boolean);
    const usedDigitalTxs = await prisma.digitalTransaction.findMany({
      where: {
        report: { storeId },
      },
      select: { flipId: true }
    });
    
    // Normalize flipIds (remove leading #)
    const usedSet = new Set(
      usedDigitalTxs
        .map(dt => dt.flipId?.replace(/^#/, "") || "")
        .filter(Boolean)
    );

    const resolvedTransactions = transactions.map(t => ({
      ...t,
      matched: usedSet.has(t.flipId)
    }));

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
 *   1. Are within the same day as the report
 *   2. Are not excluded by admin
 *   3. Their flipId does NOT match any digitalTransaction.flipId in this report
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
        store: { select: { timezone: true } },
      },
    });

    if (!report || report.storeId !== session.user.storeId) {
      return { success: false, error: "Report not found" };
    }

    // Get all non-excluded flip transactions for that specific valid day in the store's timezone
    const reportDate = report.date;
    const { start: dayStart, end: dayEnd } = getTZDateRange(reportDate, report.store.timezone || "Asia/Jakarta");

    const flipTxs = await prisma.flipWebhook.findMany({
      where: {
        storeId: report.storeId,
        excluded: false,
        transactionTime: { gte: dayStart, lte: dayEnd },
      },
    });

    // Get flipIds from report's digital transactions (strip leading #)
    const reportFlipIds = new Set(
      report.digitalTransactions
        .map((dt) => dt.flipId?.replace(/^#/, "") || "")
        .filter(Boolean)
    );

    // Unmatched = in email but NOT in report
    const unmatched = flipTxs.filter((ft) => !reportFlipIds.has(ft.flipId));

    // Update matched status for those that ARE matched
    const matchedIds = flipTxs
      .filter((ft) => reportFlipIds.has(ft.flipId))
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
