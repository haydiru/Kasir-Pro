"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serialize, ActionResponse } from "@/lib/serialize";
import { getTZDateRange, formatLocalDate } from "@/lib/utils";

// ───── Types ─────

export interface DashboardSummary {
  totalOmzet: number;
  omzetCash: number;
  omzetDebit: number;
  totalExpenditure: number;
  digitalRevenue: number;
  digitalProfit: number;
}

export interface DailyChartEntry {
  date: string;
  omzetCash: number;
  omzetDebit: number;
  expenditure: number;
  digitalRevenue: number;
  digitalProfit: number;
}

export interface DashboardStatsResult {
  summary: DashboardSummary;
  daily: DailyChartEntry[];
}

// ───── Cashier-level dashboard (existing) ─────

export async function getDashboardData(): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.storeId) {
            return { success: false, error: "Unauthorized" };
        }

        const store = await prisma.store.findUnique({
            where: { id: session.user.storeId }
        });
        const timezone = store?.timezone || "Asia/Jakarta";

        const { start: startOfDay, end: endOfDay } = getTZDateRange(new Date(), timezone);

        // 1. Get Active Attendance
        const attendance = await prisma.attendance.findFirst({
            where: {
                userId: session.user.id,
                clockOut: null,
            },
        });

        // 2. Daily Digital Stats (for the user today)
        const digitalStats = await prisma.digitalTransaction.aggregate({
            where: {
                createdBy: session.user.id,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            _count: true,
            _sum: {
                grossAmount: true,
            },
        });

        // 3. Daily Expenditure Stats
        const expenditureStats = await prisma.expenditure.aggregate({
            where: {
                createdBy: session.user.id,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            _count: true,
            _sum: {
                amountFromBill: true,
                amountFromCashier: true,
                amountFromTransfer: true,
            },
        });

        const totalExpenditure = (expenditureStats._sum.amountFromBill || 0) + 
                                 (expenditureStats._sum.amountFromCashier || 0) + 
                                 (expenditureStats._sum.amountFromTransfer || 0);

        return {
            success: true,
            data: {
                attendance: serialize(attendance),
                digital: {
                    count: digitalStats._count || 0,
                    total: digitalStats._sum.grossAmount || 0,
                },
                expenditure: {
                    count: expenditureStats._count || 0,
                    total: totalExpenditure,
                },
            },
        };
    } catch (error: unknown) {
        console.error("getDashboardData error:", error);
        return { success: false, error: "Gagal memuat data dashboard" };
    }
}

// ───── Admin Dashboard Stats (NEW) ─────

/**
 * Fetches aggregated dashboard statistics for the admin panel.
 * Accepts start and end dates as YYYY-MM-DD strings.
 * Returns summary totals and daily breakdown for charts.
 */
export async function getAdminDashboardStats(
  startDate: string,
  endDate: string
): Promise<ActionResponse<DashboardStatsResult>> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }
    if (session.user.role !== "admin" && session.user.role !== "super_admin") {
      return { success: false, error: "Forbidden" };
    }

    const storeId = session.user.storeId;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true },
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    // Build UTC date range from the local date strings
    const rangeStart = getTZDateRange(new Date(startDate + "T00:00:00"), timezone).start;
    const rangeEnd = getTZDateRange(new Date(endDate + "T00:00:00"), timezone).end;

    // Fetch all Submitted/Verified reports in range, with relations
    const reports = await prisma.shiftReport.findMany({
      where: {
        storeId,
        status: { in: ["Submitted", "Verified"] },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        digitalTransactions: true,
        expenditures: true,
      },
      orderBy: { date: "asc" },
    });

    // ── Aggregate ──
    const summary: DashboardSummary = {
      totalOmzet: 0,
      omzetCash: 0,
      omzetDebit: 0,
      totalExpenditure: 0,
      digitalRevenue: 0,
      digitalProfit: 0,
    };

    const dailyMap = new Map<string, DailyChartEntry>();

    for (const report of reports) {
      const localDay = formatLocalDate(report.date, timezone);

      // Initialize day bucket if needed
      if (!dailyMap.has(localDay)) {
        dailyMap.set(localDay, {
          date: localDay,
          omzetCash: 0,
          omzetDebit: 0,
          expenditure: 0,
          digitalRevenue: 0,
          digitalProfit: 0,
        });
      }
      const day = dailyMap.get(localDay)!;

      // POS
      day.omzetCash += report.posCash;
      day.omzetDebit += report.posDebit;
      summary.omzetCash += report.posCash;
      summary.omzetDebit += report.posDebit;

      // Expenditures
      for (const ex of report.expenditures) {
        const exTotal =
          (ex.amountFromBill || 0) +
          (ex.amountFromCashier || 0) +
          (ex.amountFromTransfer || 0);
        day.expenditure += exTotal;
        summary.totalExpenditure += exTotal;
      }

      // Digital Transactions
      for (const tx of report.digitalTransactions) {
        day.digitalRevenue += tx.grossAmount;
        day.digitalProfit += tx.profitAmount;
        summary.digitalRevenue += tx.grossAmount;
        summary.digitalProfit += tx.profitAmount;
      }
    }

    summary.totalOmzet = summary.omzetCash + summary.omzetDebit;

    // Convert map to sorted array
    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return {
      success: true,
      data: { summary, daily },
    };
  } catch (error: unknown) {
    console.error("getAdminDashboardStats error:", error);
    return { success: false, error: "Gagal memuat statistik dashboard" };
  }
}
