"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serialize, ActionResponse } from "@/lib/serialize";
import { getTZDateRange, formatLocalDate } from "@/lib/utils";

// ───── Types ─────

export interface DashboardSummary {
  todayOmzet: number;
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

export interface WeeklyTrendEntry {
  weekLabel: string;
  omzetCash: number;
  omzetDebit: number;
  totalOmzet: number;
  digitalRevenue: number;
  digitalProfit: number;
  expenditure: number;
}

export interface MonthlyTrendEntry {
  monthLabel: string;
  omzetCash: number;
  omzetDebit: number;
  totalOmzet: number;
  digitalRevenue: number;
  digitalProfit: number;
  expenditure: number;
}

export interface WeekdayVsWeekendStats {
  weekday: {
    shiftCount: number;
    totalOmzet: number;
    avgOmzetPerShift: number;
    omzetCash: number;
    omzetDebit: number;
    cashPercent: number;
    debitPercent: number;
    digitalProfit: number;
  };
  weekend: {
    shiftCount: number;
    totalOmzet: number;
    avgOmzetPerShift: number;
    omzetCash: number;
    omzetDebit: number;
    cashPercent: number;
    debitPercent: number;
    digitalProfit: number;
  };
  weekendSurgePercent: number;
  busiestDayName: string;
  busiestDayOmzet: number;
}

export interface ConsumerBehaviorInsight {
  id: string;
  category: "payment_habit" | "peak_period" | "digital_trend" | "recommendation";
  title: string;
  description: string;
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
  weekly: WeeklyTrendEntry[];
  monthly: MonthlyTrendEntry[];
  weekdayVsWeekend: WeekdayVsWeekendStats;
  userPerformance: UserPerformanceEntry[];
  insights: SmartInsight[];
  consumerInsights: ConsumerBehaviorInsight[];
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
 * Helper to get week label (e.g., "Minggu 1 (01 Jan)", etc.)
 */
function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dayOfMonth = d.getDate();
  const weekNum = Math.ceil(dayOfMonth / 7);
  const monthName = d.toLocaleDateString("id-ID", { month: "short" });
  return `Minggu ${weekNum} (${monthName})`;
}

/**
 * Helper to get month label (e.g., "Jan 2026")
 */
function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

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

    const rangeStart = startDate === "2020-01-01" || startDate === "all" || !startDate
      ? new Date(0)
      : getTZDateRange(new Date(startDate + "T00:00:00"), timezone).start;
    const rangeEnd = getTZDateRange(new Date(endDate + "T00:00:00"), timezone).end;

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

    // Today's omzet specifically for "Omzet Hari Ini" card
    const todayTZRange = getTZDateRange(new Date(), timezone);
    const todayReports = await prisma.shiftReport.findMany({
      where: {
        storeId,
        status: { in: ["Submitted", "Verified"] },
        date: { gte: todayTZRange.start, lte: todayTZRange.end },
      },
      select: { posCash: true, posDebit: true },
    });
    const todayOmzet = todayReports.reduce((sum, r) => sum + r.posCash + r.posDebit, 0);

    // ── Global Summary ──
    const summary: DashboardSummary = {
      todayOmzet,
      totalOmzet: 0,
      omzetCash: 0,
      omzetDebit: 0,
      totalExpenditure: 0,
      digitalRevenue: 0,
      digitalProfit: 0,
    };

    const dailyMap = new Map<string, DailyChartEntry>();
    const weeklyMap = new Map<string, WeeklyTrendEntry>();
    const monthlyMap = new Map<string, MonthlyTrendEntry>();

    // Weekday vs Weekend Trackers
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dayOmzetMap = new Map<number, { omzet: number; count: number }>();
    for (let i = 0; i < 7; i++) {
      dayOmzetMap.set(i, { omzet: 0, count: 0 });
    }

    const weekdayData = {
      shiftCount: 0,
      totalOmzet: 0,
      omzetCash: 0,
      omzetDebit: 0,
      digitalProfit: 0,
      uniqueDays: new Set<string>(),
    };

    const weekendData = {
      shiftCount: 0,
      totalOmzet: 0,
      omzetCash: 0,
      omzetDebit: 0,
      digitalProfit: 0,
      uniqueDays: new Set<string>(),
    };

    // Per User Map
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
      const dateObj = new Date(localDay + "T12:00:00");
      const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const reportOmzet = report.posCash + report.posDebit;

      // Track per day of week
      const dStat = dayOmzetMap.get(dayOfWeek)!;
      dStat.omzet += reportOmzet;
      dStat.count += 1;

      // Track Weekday vs Weekend
      if (isWeekend) {
        weekendData.shiftCount += 1;
        weekendData.totalOmzet += reportOmzet;
        weekendData.omzetCash += report.posCash;
        weekendData.omzetDebit += report.posDebit;
        weekendData.uniqueDays.add(localDay);
      } else {
        weekdayData.shiftCount += 1;
        weekdayData.totalOmzet += reportOmzet;
        weekdayData.omzetCash += report.posCash;
        weekdayData.omzetDebit += report.posDebit;
        weekdayData.uniqueDays.add(localDay);
      }

      // Initialize Daily Map
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

      // Initialize Weekly Map
      const weekLabel = getWeekLabel(localDay);
      if (!weeklyMap.has(weekLabel)) {
        weeklyMap.set(weekLabel, {
          weekLabel,
          omzetCash: 0,
          omzetDebit: 0,
          totalOmzet: 0,
          digitalRevenue: 0,
          digitalProfit: 0,
          expenditure: 0,
        });
      }
      const week = weeklyMap.get(weekLabel)!;

      // Initialize Monthly Map
      const monthLabel = getMonthLabel(localDay);
      if (!monthlyMap.has(monthLabel)) {
        monthlyMap.set(monthLabel, {
          monthLabel,
          omzetCash: 0,
          omzetDebit: 0,
          totalOmzet: 0,
          digitalRevenue: 0,
          digitalProfit: 0,
          expenditure: 0,
        });
      }
      const month = monthlyMap.get(monthLabel)!;

      // POS Cash & Debit
      day.omzetCash += report.posCash;
      day.omzetDebit += report.posDebit;
      week.omzetCash += report.posCash;
      week.omzetDebit += report.posDebit;
      week.totalOmzet += reportOmzet;
      month.omzetCash += report.posCash;
      month.omzetDebit += report.posDebit;
      month.totalOmzet += reportOmzet;

      summary.omzetCash += report.posCash;
      summary.omzetDebit += report.posDebit;

      // Expenditures
      let reportExTotal = 0;
      for (const ex of report.expenditures) {
        const exTotal =
          (ex.amountFromBill || 0) +
          (ex.amountFromCashier || 0) +
          (ex.amountFromTransfer || 0);
        reportExTotal += exTotal;
      }
      day.expenditure += reportExTotal;
      week.expenditure += reportExTotal;
      month.expenditure += reportExTotal;
      summary.totalExpenditure += reportExTotal;

      // Digital Transactions
      for (const tx of report.digitalTransactions) {
        day.digitalRevenue += tx.grossAmount;
        day.digitalProfit += tx.profitAmount;
        week.digitalRevenue += tx.grossAmount;
        week.digitalProfit += tx.profitAmount;
        month.digitalRevenue += tx.grossAmount;
        month.digitalProfit += tx.profitAmount;

        summary.digitalRevenue += tx.grossAmount;
        summary.digitalProfit += tx.profitAmount;

        if (isWeekend) {
          weekendData.digitalProfit += tx.profitAmount;
        } else {
          weekdayData.digitalProfit += tx.profitAmount;
        }
      }

      // Per User Stats
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

    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const weekly = Array.from(weeklyMap.values());
    const monthly = Array.from(monthlyMap.values());

    // ── Weekday vs Weekend Final Calculation ──
    const weekdayTotalOmzet = weekdayData.totalOmzet;
    const weekendTotalOmzet = weekendData.totalOmzet;

    const weekdayCashPct = weekdayTotalOmzet > 0 ? Math.round((weekdayData.omzetCash / weekdayTotalOmzet) * 100) : 0;
    const weekdayDebitPct = weekdayTotalOmzet > 0 ? Math.round((weekdayData.omzetDebit / weekdayTotalOmzet) * 100) : 0;

    const weekendCashPct = weekendTotalOmzet > 0 ? Math.round((weekendData.omzetCash / weekendTotalOmzet) * 100) : 0;
    const weekendDebitPct = weekendTotalOmzet > 0 ? Math.round((weekendData.omzetDebit / weekendTotalOmzet) * 100) : 0;

    const weekdayDaysCount = Math.max(1, weekdayData.uniqueDays.size);
    const weekendDaysCount = Math.max(1, weekendData.uniqueDays.size);

    const weekdayDailyAvg = Math.round(weekdayTotalOmzet / weekdayDaysCount);
    const weekendDailyAvg = Math.round(weekendTotalOmzet / weekendDaysCount);

    const weekendSurgePercent = weekdayDailyAvg > 0
      ? Math.round(((weekendDailyAvg - weekdayDailyAvg) / weekdayDailyAvg) * 100)
      : 0;

    // Find busiest day
    let busiestDayIdx = 0;
    let maxDayOmzet = 0;
    dayOmzetMap.forEach((val, dayIdx) => {
      if (val.omzet > maxDayOmzet) {
        maxDayOmzet = val.omzet;
        busiestDayIdx = dayIdx;
      }
    });

    const weekdayVsWeekend: WeekdayVsWeekendStats = {
      weekday: {
        shiftCount: weekdayData.shiftCount,
        totalOmzet: weekdayTotalOmzet,
        avgOmzetPerShift: weekdayData.shiftCount > 0 ? Math.round(weekdayTotalOmzet / weekdayData.shiftCount) : 0,
        omzetCash: weekdayData.omzetCash,
        omzetDebit: weekdayData.omzetDebit,
        cashPercent: weekdayCashPct,
        debitPercent: weekdayDebitPct,
        digitalProfit: weekdayData.digitalProfit,
      },
      weekend: {
        shiftCount: weekendData.shiftCount,
        totalOmzet: weekendTotalOmzet,
        avgOmzetPerShift: weekendData.shiftCount > 0 ? Math.round(weekendTotalOmzet / weekendData.shiftCount) : 0,
        omzetCash: weekendData.omzetCash,
        omzetDebit: weekendData.omzetDebit,
        cashPercent: weekendCashPct,
        debitPercent: weekendDebitPct,
        digitalProfit: weekendData.digitalProfit,
      },
      weekendSurgePercent,
      busiestDayName: dayNames[busiestDayIdx] || "Sabtu",
      busiestDayOmzet: maxDayOmzet,
    };

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

    // ── Generate Smart Insights ──
    const insights: SmartInsight[] = [];

    if (userPerformance.length > 0) {
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

    // ── Generate Consumer Behavior Insights ──
    const consumerInsights: ConsumerBehaviorInsight[] = [];

    // 1. Peak Days & Surge Insight
    if (weekendSurgePercent !== 0) {
      const surgeLabel = weekendSurgePercent > 0 ? `peningkatan +${weekendSurgePercent}%` : `penurunan ${weekendSurgePercent}%`;
      consumerInsights.push({
        id: "peak-days",
        category: "peak_period",
        title: `🛍️ Pola Belanja Weekend (Hari Puncak: ${weekdayVsWeekend.busiestDayName})`,
        description: `Rata-rata penjualan harian pada Akhir Pekan (Sabtu-Minggu) mengalami ${surgeLabel} dibandingkan Hari Kerja (Senin-Jumat). Hari terramai adalah hari ${weekdayVsWeekend.busiestDayName}. Pastikan persediaan barang terlaris sudah diisi penuh sebelum hari Jumat.`,
      });
    }

    // 2. Payment Method Habits
    if (summary.totalOmzet > 0) {
      consumerInsights.push({
        id: "payment-habits",
        category: "payment_habit",
        title: "💳 Kebiasaan Pembayaran Masyarakat",
        description: `Pada Hari Kerja, masyarakat menggunakan Tunai (${weekdayCashPct}%) dan Non-Tunai/Debit (${weekdayDebitPct}%). Di Akhir Pekan, pembayaran Non-Tunai/Debit tercatat (${weekendDebitPct}%). Pastikan mesin EDC / QRIS selalu aktif dan siap melayani lonjakan non-tunai.`,
      });
    }

    // 3. Digital Profit Behavior
    if (summary.digitalProfit > 0) {
      const digitalPct = Math.round((summary.digitalProfit / (summary.totalOmzet || 1)) * 100);
      consumerInsights.push({
        id: "digital-trend",
        category: "digital_trend",
        title: "⚡ Tren Pembelian Layanan Digital",
        description: `Masyarakat menyumbangkan total Laba Digital sebesar Rp ${summary.digitalProfit.toLocaleString("id-ID")} dalam periode ini. Penggunaan layanan e-wallet & token listrik menjadi sumber marjin tinggi yang konsisten.`,
      });
    }

    // 4. Actionable Stock & Staff Recommendation
    consumerInsights.push({
      id: "recommendation",
      category: "recommendation",
      title: "🎯 Rekomendasi Strategi Toko & Promosi",
      description: `Gunakan pola weekday untuk promo bundling produk cepat saji / kebutuhan harian untuk mendongkrak omzet hari kerja. Tempatkan kasir berkecepatan tinggi pada hari ${weekdayVsWeekend.busiestDayName} dan akhir pekan untuk mencegah antrean panjang.`,
    });

    return {
      success: true,
      data: {
        summary,
        daily,
        weekly,
        monthly,
        weekdayVsWeekend,
        userPerformance,
        insights,
        consumerInsights,
      },
    };
  } catch (error: unknown) {
    console.error("getAdminDashboardStats error:", error);
    return { success: false, error: "Gagal memuat statistik dashboard" };
  }
}
