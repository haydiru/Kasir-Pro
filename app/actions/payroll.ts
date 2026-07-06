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
 * Calculates the start and end dates for the payroll cycle with timezone accuracy.
 */
function createLocalDate(year: number, month: number, day: number, hour: number, minute: number, second: number, ms: number, timeZone: string): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const tzString = utcDate.toLocaleString("en-US", { timeZone, hour12: false });
  
  const match = tzString.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/);
  if (!match) return utcDate;
  
  const tzMonth = parseInt(match[1]);
  const tzDay = parseInt(match[2]);
  const tzYear = parseInt(match[3]);
  const tzHour = parseInt(match[4]);
  const tzMinute = parseInt(match[5]);
  const tzSecond = parseInt(match[6]);
  
  const parsedTzDate = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond, ms);
  const offset = utcDate.getTime() - parsedTzDate;
  
  return new Date(utcDate.getTime() + offset);
}

function getPayrollRange(
  cycleStart: number,
  cycleEnd: number,
  timeZone: string,
  periodOffset: number = 0,
  referenceDate: Date = new Date()
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(referenceDate);
  const partMap: Record<string, string> = {};
  parts.forEach(p => partMap[p.type] = p.value);
  
  const refYear = parseInt(partMap.year);
  const refMonth = parseInt(partMap.month); // 1-12
  const refDay = parseInt(partMap.day);

  const getRangeForStartMonth = (startYear: number, startMonth: number) => {
    const start = createLocalDate(startYear, startMonth, cycleStart, 0, 0, 0, 0, timeZone);
    let end: Date;
    if (cycleEnd < cycleStart) {
      let endYear = startYear;
      let endMonth = startMonth + 1;
      if (endMonth > 12) {
        endMonth = 1;
        endYear += 1;
      }
      end = createLocalDate(endYear, endMonth, cycleEnd, 23, 59, 59, 999, timeZone);
    } else {
      end = createLocalDate(startYear, startMonth, cycleEnd, 23, 59, 59, 999, timeZone);
    }
    return { start, end, startYear, startMonth };
  };

  const candA = getRangeForStartMonth(refYear, refMonth);
  let prevMonth = refMonth - 1;
  let prevYear = refYear;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const candB = getRangeForStartMonth(prevYear, prevMonth);

  const currentStart = referenceDate.getTime() >= candA.start.getTime() ? candA : candB;

  let targetMonth = currentStart.startMonth + periodOffset;
  let targetYear = currentStart.startYear;
  
  while (targetMonth < 1) {
    targetMonth += 12;
    targetYear -= 1;
  }
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }

  return getRangeForStartMonth(targetYear, targetMonth);
}

export async function getPayrollRecap(periodOffset: number = 0) {
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
    const { start, end } = getPayrollRange(user.payrollCycleStart, user.payrollCycleEnd, timezone, periodOffset);
    
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
  const { start, end } = getPayrollRange(user.payrollCycleStart, user.payrollCycleEnd, timezone, 0);
  
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
