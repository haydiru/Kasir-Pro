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

export interface UserPerformanceEntry {
  userId: string;
  userName: string;
  userRole: string;
  shiftCount: number;
  totalOmzet: number;
  omzetCash: number;
  omzetDebit: number;
  avgOmzetPerShift: number;
  digitalRevenue: number;
  digitalProfit: number;
  digitalCount: number;
  topDigitalService: string;
  totalExpenditure: number;
  totalVariance: number;
  verifiedShiftCount: number;
  accurateShiftCount: number;
  accuracyRate: number; // percentage (0 - 100)
}

export interface SmartInsight {
  id: string;
  type: "success" | "warning" | "info" | "opportunity";
  title: string;
  description: string;
}

export interface DashboardStatsResult {
  summary: DashboardSummary;
  daily: DailyChartEntry[];
  userPerformance: UserPerformanceEntry[];
  insights: SmartInsight[];
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

// ───── Admin Dashboard Stats ─────

/**
 * Fetches aggregated dashboard statistics for the admin panel.
 * Accepts start and end dates as YYYY-MM-DD strings.
 * Returns summary totals, daily breakdown for charts, user performance leaderboard, and smart insights.
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
        user: { select: { id: true, name: true, role: true } },
        digitalTransactions: true,
        expenditures: true,
      },
      orderBy: { date: "asc" },
    });

    // ── Global Aggregate Summary ──
    const summary: DashboardSummary = {
      totalOmzet: 0,
      omzetCash: 0,
      omzetDebit: 0,
      totalExpenditure: 0,
      digitalRevenue: 0,
      digitalProfit: 0,
    };

    const dailyMap = new Map<string, DailyChartEntry>();

    // ── Per User Aggregation Map ──
    const userMap = new Map<string, {
      userId: string;
      userName: string;
      userRole: string;
      shiftCount: number;
      omzetCash: number;
      omzetDebit: number;
      digitalRevenue: number;
      digitalProfit: number;
      digitalCount: number;
      serviceCounts: Map<string, number>;
      totalExpenditure: number;
      totalVariance: number;
      verifiedShiftCount: number;
      accurateShiftCount: number;
    }>();

    for (const report of reports) {
      const localDay = formatLocalDate(report.date, timezone);

      // Initialize day bucket
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

      // ── Per User Stats ──
      const uId = report.userId;
      const uName = report.user?.name || "Kasir/Pramuniaga";
      const uRole = report.user?.role || "cashier";

      if (!userMap.has(uId)) {
        userMap.set(uId, {
          userId: uId,
          userName: uName,
          userRole: uRole,
          shiftCount: 0,
          omzetCash: 0,
          omzetDebit: 0,
          digitalRevenue: 0,
          digitalProfit: 0,
          digitalCount: 0,
          serviceCounts: new Map<string, number>(),
          totalExpenditure: 0,
          totalVariance: 0,
          verifiedShiftCount: 0,
          accurateShiftCount: 0,
        });
      }

      const uStats = userMap.get(uId)!;
      uStats.shiftCount += 1;
      uStats.omzetCash += report.posCash;
      uStats.omzetDebit += report.posDebit;

      if (report.status === "Verified") {
        uStats.verifiedShiftCount += 1;
        if (report.finalAdminVariance !== null) {
          uStats.totalVariance += report.finalAdminVariance;
          if (report.finalAdminVariance >= 0) {
            uStats.accurateShiftCount += 1;
          }
        } else {
          uStats.accurateShiftCount += 1;
        }
      }

      for (const ex of report.expenditures) {
        uStats.totalExpenditure +=
          (ex.amountFromBill || 0) +
          (ex.amountFromCashier || 0) +
          (ex.amountFromTransfer || 0);
      }

      for (const tx of report.digitalTransactions) {
        uStats.digitalRevenue += tx.grossAmount;
        uStats.digitalProfit += tx.profitAmount;
        uStats.digitalCount += 1;

        const sType = tx.serviceType || "Lain-lain";
        uStats.serviceCounts.set(sType, (uStats.serviceCounts.get(sType) || 0) + 1);
      }
    }

    summary.totalOmzet = summary.omzetCash + summary.omzetDebit;

    // Convert map to sorted array
    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Convert userMap to UserPerformanceEntry array
    const userPerformance: UserPerformanceEntry[] = Array.from(userMap.values())
      .map((u) => {
        const totalOmzet = u.omzetCash + u.omzetDebit;
        const avgOmzetPerShift = u.shiftCount > 0 ? Math.round(totalOmzet / u.shiftCount) : 0;

        let topDigitalService = "Belum Ada";
        let maxCount = 0;
        u.serviceCounts.forEach((count, service) => {
          if (count > maxCount) {
            maxCount = count;
            topDigitalService = service;
          }
        });

        const accuracyRate =
          u.verifiedShiftCount > 0
            ? Math.round((u.accurateShiftCount / u.verifiedShiftCount) * 100)
            : 100;

        return {
          userId: u.userId,
          userName: u.userName,
          userRole: u.userRole,
          shiftCount: u.shiftCount,
          totalOmzet,
          omzetCash: u.omzetCash,
          omzetDebit: u.omzetDebit,
          avgOmzetPerShift,
          digitalRevenue: u.digitalRevenue,
          digitalProfit: u.digitalProfit,
          digitalCount: u.digitalCount,
          topDigitalService,
          totalExpenditure: u.totalExpenditure,
          totalVariance: u.totalVariance,
          verifiedShiftCount: u.verifiedShiftCount,
          accurateShiftCount: u.accurateShiftCount,
          accuracyRate,
        };
      })
      .sort((a, b) => b.totalOmzet - a.totalOmzet);

    // ── Generate Smart Business Insights ──
    const insights: SmartInsight[] = [];

    if (userPerformance.length > 0) {
      // 1. Top Omzet Performer
      const topOmzetUser = [...userPerformance].sort(
        (a, b) => b.avgOmzetPerShift - a.avgOmzetPerShift
      )[0];
      if (topOmzetUser && topOmzetUser.avgOmzetPerShift > 0) {
        insights.push({
          id: "top-omzet",
          type: "success",
          title: `🏆 Pegawai Omzet Tertinggi: ${topOmzetUser.userName}`,
          description: `${topOmzetUser.userName} mencatat rata-rata omzet Rp ${topOmzetUser.avgOmzetPerShift.toLocaleString("id-ID")}/shift (Total Omzet: Rp ${topOmzetUser.totalOmzet.toLocaleString("id-ID")} dari ${topOmzetUser.shiftCount} shift). Sangat direkomendasikan ditempatkan pada shift jam sibuk (peak hours).`,
        });
      }

      // 2. Top Digital Profit Performer
      const topDigitalUser = [...userPerformance].sort(
        (a, b) => b.digitalProfit - a.digitalProfit
      )[0];
      if (topDigitalUser && topDigitalUser.digitalProfit > 0) {
        insights.push({
          id: "top-digital",
          type: "opportunity",
          title: `💎 Jawara Laba Digital: ${topDigitalUser.userName}`,
          description: `${topDigitalUser.userName} menyumbang laba digital terbesar senilai Rp ${topDigitalUser.digitalProfit.toLocaleString("id-ID")} (Layanan favorit: ${topDigitalUser.topDigitalService}). Terapkan strategi upselling yang sama ke tim kasir lainnya!`,
        });
      }

      // 3. Digital Upselling Opportunity
      const lowDigitalUsers = userPerformance.filter(
        (u) => u.digitalCount === 0 && u.shiftCount > 0
      );
      if (lowDigitalUsers.length > 0) {
        const names = lowDigitalUsers.map((u) => u.userName).join(", ");
        insights.push({
          id: "upsell-opportunity",
          type: "info",
          title: "📈 Potensi Peningkatan Transaksi Digital",
          description: `Pegawai (${names}) belum/jarang mencatatkan transaksi digital (Top Up / PLN / Pulsa). Berikan edukasi penawaran transaksi digital kepada pelanggan saat proses pembayaran untuk menambah margin profit.`,
        });
      }

      // 4. Cash Accuracy & Variance Alert
      const lowAccuracyUsers = userPerformance.filter(
        (u) => u.accuracyRate < 80 && u.verifiedShiftCount > 0
      );
      if (lowAccuracyUsers.length > 0) {
        const names = lowAccuracyUsers
          .map((u) => `${u.userName} (${u.accuracyRate}%)`)
          .join(", ");
        insights.push({
          id: "cash-accuracy",
          type: "warning",
          title: "⚠️ Perhatian Akurasi Kasir",
          description: `Beberapa pegawai memiliki tingkat akurasi pencatatan uang fisik di bawah 80%: ${names}. Evaluasi kembali proses hitung uang dan pencatatan pengeluaran kasir.`,
        });
      }
    }

    return {
      success: true,
      data: { summary, daily, userPerformance, insights },
    };
  } catch (error: unknown) {
    console.error("getAdminDashboardStats error:", error);
    return { success: false, error: "Gagal memuat statistik dashboard" };
  }
}
