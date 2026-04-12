"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export interface PayrollRecapItem {
  userId: string;
  name: string;
  role: string;
  cycleStart: number;
  cycleEnd: number;
  periodLabel: string;
  totalDays: number;
  totalHours: number;
  isCurrentlyActive: boolean;
}

/**
 * Calculates the start and end dates for the current payroll cycle.
 */
function getActivePayrollRange(cycleStart: number, cycleEnd: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let start: Date;
  let end: Date;

  if (day >= cycleStart) {
    // Current cycle started this month
    start = new Date(year, month, cycleStart);
    // End is next month's cycleEnd
    end = new Date(year, month + 1, cycleEnd, 23, 59, 59, 999);
  } else {
    // Current cycle started last month
    start = new Date(year, month - 1, cycleStart);
    // End is this month's cycleEnd
    end = new Date(year, month, cycleEnd, 23, 59, 59, 999);
  }

  return { start, end };
}

export async function getPayrollRecap() {
  const session = await auth();
  if (!session?.user?.storeId) throw new Error("Unauthorized");
  const storeId = session.user.storeId;

  // 1. Get all employees in the store
  const employees = await prisma.user.findMany({
    where: { storeId },
    orderBy: { name: "asc" }
  });

  const recap: PayrollRecapItem[] = [];

  for (const user of employees) {
    const { start, end } = getActivePayrollRange(user.payrollCycleStart, user.payrollCycleEnd);
    
    // 2. Fetch all attendance logs in this range
    const logs = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        clockIn: {
          gte: start,
          lte: end
        }
      }
    });

    // 3. Aggregate stats
    // Count days based on unique date (YYYY-MM-DD)
    const uniqueDays = new Set(logs.map(log => log.clockIn.toISOString().split("T")[0]));
    
    let totalMs = 0;
    let isCurrentlyActive = false;

    logs.forEach(log => {
      if (log.clockOut) {
        totalMs += log.clockOut.getTime() - log.clockIn.getTime();
      } else {
        isCurrentlyActive = true;
        // Still counting the current session up to "now" for estimate
        totalMs += Date.now() - log.clockIn.getTime();
      }
    });

    const totalHours = totalMs / (1000 * 60 * 60);

    const periodLabel = `${start.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}`;

    recap.push({
      userId: user.id,
      name: user.name,
      role: user.role,
      cycleStart: user.payrollCycleStart,
      cycleEnd: user.payrollCycleEnd,
      periodLabel,
      totalDays: uniqueDays.size,
      totalHours: parseFloat(totalHours.toFixed(1)),
      isCurrentlyActive
    });
  }

  return recap;
}
