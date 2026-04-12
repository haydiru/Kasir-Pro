"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serialize, ActionResponse } from "@/lib/serialize";

export async function getAvailableShifts(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: true, data: [] };

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
    
    let result;
    if (specialShifts.length > 0) {
      result = specialShifts;
    } else {
      result = baseShifts.filter(s => s.dayOfWeek === null);
    }

    return { 
      success: true, 
      data: serialize(result) 
    };
  } catch (error: any) {
    console.error("getAvailableShifts error:", error);
    return { success: false, error: "Gagal mengambil daftar shift" };
  }
}
