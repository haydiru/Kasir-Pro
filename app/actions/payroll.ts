"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatLocalDate } from "@/lib/utils";

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
/**
 * Calculates the start and end dates for the current payroll cycle.
 */
function getActivePayrollRange(cycleStart: number, cycleEnd: number, timeZone: string) {
  const now = new Date();
  
  // Get components in target TZ
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  parts.forEach(p => partMap[p.type] = p.value);
  
  const year = parseInt(partMap.year);
  const month = parseInt(partMap.month) - 1; // 0-indexed
  const day = parseInt(partMap.day);

  let start: Date;
  let end: Date;

  const getUTC = (s: string) => {
    const d = new Date(s);
    const inv = new Date(d.toLocaleString("en-US", { timeZone }));
    const diff = d.getTime() - inv.getTime();
    return new Date(d.getTime() + diff);
  };

  if (day >= cycleStart) {
    // Current cycle started this month
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(cycleStart).padStart(2, '0')}T00:00:00`;
    // End is next month's cycleEnd
    const endStr = `${month === 11 ? year + 1 : year}-${String((month + 1) % 12 + 1).padStart(2, '0')}-${String(cycleEnd).padStart(2, '0')}T23:59:59.999`;
    start = getUTC(startStr);
    end = getUTC(endStr);
  } else {
    // Current cycle started last month
    const startStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(cycleStart).padStart(2, '0')}T00:00:00`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(cycleEnd).padStart(2, '0')}T23:59:59.999`;
    start = getUTC(startStr);
    end = getUTC(endStr);
  }

  return { start, end };
}

export async function getPayrollRecap() {
  const session = await auth();
  if (!session?.user?.storeId) throw new Error("Unauthorized");
  const storeId = session.user.storeId;

  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });
  const timezone = store?.timezone || "Asia/Jakarta";

  // 1. Get all employees in the store
  const employees = await prisma.user.findMany({
    where: { storeId },
    orderBy: { name: "asc" }
  });

  const recap: PayrollRecapItem[] = [];

  for (const user of employees) {
    const { start, end } = getActivePayrollRange(user.payrollCycleStart, user.payrollCycleEnd, timezone);
    
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
    const uniqueDays = new Set(logs.map(log => formatLocalDate(log.clockIn, timezone)));
    
    let totalMs = 0;
    let isCurrentlyActive = false;

    logs.forEach(log => {
      if (log.clockOut) {
        totalMs += log.clockOut.getTime() - log.clockIn.getTime();
      } else {
        isCurrentlyActive = true;
        totalMs += Date.now() - log.clockIn.getTime();
      }
    });

    const totalHours = totalMs / (1000 * 60 * 60);

    const periodLabel = `${start.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', timeZone: timezone })} - ${end.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', timeZone: timezone })}`;

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

export async function getMyPayrollStats() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { store: true }
  });

  if (!user) throw new Error("User not found");

  const timezone = user.store?.timezone || "Asia/Jakarta";
  const { start, end } = getActivePayrollRange(user.payrollCycleStart, user.payrollCycleEnd, timezone);
  
  const logs = await prisma.attendance.findMany({
    where: {
      userId: user.id,
      clockIn: {
        gte: start,
        lte: end
      }
    }
  });

  const uniqueDays = new Set(logs.map(log => formatLocalDate(log.clockIn, timezone)));
    
  let totalMs = 0;
  logs.forEach(log => {
    if (log.clockOut) {
      totalMs += log.clockOut.getTime() - log.clockIn.getTime();
    } else {
      totalMs += Date.now() - log.clockIn.getTime();
    }
  });

  const totalHours = totalMs / (1000 * 60 * 60);
  const periodLabel = `${start.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', timeZone: timezone })} - ${end.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', timeZone: timezone })}`;

  return {
    totalDays: uniqueDays.size,
    totalHours: parseFloat(totalHours.toFixed(1)),
    periodLabel,
    cycleStart: user.payrollCycleStart,
    cycleEnd: user.payrollCycleEnd
  };
}
