"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getAvailableShifts() {
  const session = await auth();
  if (!session?.user?.storeId) return [];

  const today = new Date().getDay(); // 0 is Sunday, 1 is Monday...

  const baseShifts = await prisma.shiftSetting.findMany({
    where: {
      storeId: session.user.storeId,
    },
    orderBy: { startTime: "asc" }
  });

  // Business Logic:
  // 1. If today has "Special" shifts (dayOfWeek === today), show ONLY those.
  // 2. If today has NO special shifts, show the "Default" shifts (dayOfWeek === null).
  
  const specialShifts = baseShifts.filter(s => s.dayOfWeek === today);
  
  if (specialShifts.length > 0) {
    return specialShifts;
  }
  
  return baseShifts.filter(s => s.dayOfWeek === null);
}
