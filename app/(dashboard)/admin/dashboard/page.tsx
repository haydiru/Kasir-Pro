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

  // Initial chart data: today
  const statsRes = await getAdminDashboardStats(todayStr, todayStr);
  const initialStats = statsRes.success && statsRes.data
    ? statsRes.data
    : { summary: { totalOmzet: 0, omzetCash: 0, omzetDebit: 0, totalExpenditure: 0, digitalRevenue: 0, digitalProfit: 0 }, daily: [] };

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
      payrollRecap={payrollRecap}
      initialStats={initialStats}
      initialStartDate={todayStr}
      initialEndDate={todayStr}
      timezone={timezone}
    />
  );
}
