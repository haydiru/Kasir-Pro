import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPayrollRecap } from "@/app/actions/payroll";
import { getAdminDashboardStats } from "@/app/actions/dashboard";
import { formatLocalDate } from "@/lib/utils";
import { DashboardClient } from "./dashboard-client";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const storeId = session.user.storeId;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { timezone: true },
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  // Today in local timezone
  const todayStr = formatLocalDate(new Date(), timezone);

  // Active attendances (live)
  const activeAttendances = await prisma.attendance.findMany({
    where: { storeId, clockOut: null },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  // Submitted reports count (for badge)
  const submittedCount = await prisma.shiftReport.count({
    where: { storeId, status: "Submitted" },
  });

  // Last 10 verified reports for variance table
  const verifiedReports = await prisma.shiftReport.findMany({
    where: { storeId, status: "Verified" },
    include: {
      user: { select: { name: true } },
      digitalTransactions: { select: { isNonCash: true, grossAmount: true } },
      expenditures: {
        select: {
          amountFromCashier: true,
          amountFromBill: true,
          amountFromTransfer: true,
        },
      },
    },
    orderBy: { verifiedAt: "desc" },
    take: 10,
  });

  // Payroll recap
  const payrollRecap = await getPayrollRecap();

  // Date range: Default to last 30 days for rich trend analysis
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const thirtyDaysAgoStr = formatLocalDate(thirtyDaysAgo, timezone);

  // Initial chart & user performance data: last 30 days
  const statsRes = await getAdminDashboardStats(thirtyDaysAgoStr, todayStr);
  const initialStats = statsRes.success && statsRes.data
    ? statsRes.data
    : {
        summary: { totalOmzet: 0, omzetCash: 0, omzetDebit: 0, totalExpenditure: 0, digitalRevenue: 0, digitalProfit: 0 },
        daily: [],
        weekly: [],
        monthly: [],
        weekdayVsWeekend: {
          weekday: { shiftCount: 0, totalOmzet: 0, avgOmzetPerShift: 0, omzetCash: 0, omzetDebit: 0, cashPercent: 0, debitPercent: 0, digitalProfit: 0 },
          weekend: { shiftCount: 0, totalOmzet: 0, avgOmzetPerShift: 0, omzetCash: 0, omzetDebit: 0, cashPercent: 0, debitPercent: 0, digitalProfit: 0 },
          weekendSurgePercent: 0,
          busiestDayName: "-",
          busiestDayOmzet: 0
        },
        userPerformance: [],
        insights: [],
        consumerInsights: []
      };

  // Count unmatched flips
  const flipWebhooks = await prisma.flipWebhook.findMany({
    where: { storeId, excluded: false }
  });
  const usedDigitalTxs = await prisma.digitalTransaction.findMany({
    where: { report: { storeId } },
    select: { flipId: true }
  });
  const usedSet = new Set(
    usedDigitalTxs
      .map(dt => dt.flipId?.replace(/^#/, "") || "")
      .filter(Boolean)
  );
  const unmatchedFlipCount = flipWebhooks.filter(fw => !usedSet.has(fw.flipId)).length;

  // Serialize verified reports (dates must be strings for client)
  const verifiedSerialized = verifiedReports.map((r) => ({
    ...r,
    date: formatLocalDate(r.date, timezone),
    finalAdminVariance: r.finalAdminVariance ?? null,
    adminNotes: r.adminNotes ?? null,
  }));

  return (
    <DashboardClient
      activeAttendances={activeAttendances.map((a) => ({
        id: a.id,
        user: { id: a.user.id, name: a.user.name, role: a.user.role },
        clockIn: a.clockIn.toISOString(),
        shiftType: a.shiftType,
      }))}
      submittedCount={submittedCount}
      verifiedReports={verifiedSerialized as any}
      unmatchedFlipCount={unmatchedFlipCount}
      payrollRecap={payrollRecap}
      initialStats={initialStats}
      initialStartDate={thirtyDaysAgoStr}
      initialEndDate={todayStr}
      timezone={timezone}
    />
  );
}
