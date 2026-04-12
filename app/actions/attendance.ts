"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getActiveAttendance() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: session.user.id,
      clockOut: null,
    },
    orderBy: { clockIn: "desc" },
  });

  return attendance;
}

export async function checkIn(data: { shiftType: string; actingAsCashier: boolean }) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.storeId) throw new Error("Unauthorized");

  const existing = await getActiveAttendance();
  if (existing) throw new Error("Sudah ada presensi aktif");

  const attendance = await prisma.attendance.create({
    data: {
      userId: session.user.id,
      storeId: session.user.storeId,
      shiftType: data.shiftType,
      actingAsCashier: data.actingAsCashier,
      clockIn: new Date(),
    },
  });

  revalidatePath("/attendance");
  return attendance;
}

export async function clockOut(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.attendance.update({
    where: { id },
    data: {
      clockOut: new Date(),
    },
  });

  revalidatePath("/attendance");
  return { success: true };
}

export async function getTodayAttendanceLog() {
  const session = await auth();
  if (!session?.user?.storeId) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logs = await prisma.attendance.findMany({
    where: {
      storeId: session.user.storeId,
      clockIn: {
        gte: today,
      },
    },
    include: {
      user: true,
    },
    orderBy: { clockIn: "desc" },
  });

  return logs;
}
