"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateShiftSettings(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return { error: "Akses ditolak. Hanya Admin yang dapat mengubah pengaturan ini." };
  }

  const shiftIds = formData.getAll("shiftId") as string[];
  const shiftNames = formData.getAll("shiftName") as string[];
  const startTimes = formData.getAll("startTime") as string[];
  const endTimes = formData.getAll("endTime") as string[];

  try {
    // If no shifts are provided, we might be initializing or just deleting all.
    // However, the user specifically mentioned defaults: 07:00-14:30 and 14:30-22:00.
    
    // We handle the update/create in a transaction
    await prisma.$transaction(async (tx) => {
      // If no shiftIds are present but we are called, it might be an initialization request or empty save
      if (shiftIds.length === 0) {
        // Create defaults if store has NO shifts yet
        const count = await tx.shiftSetting.count({ where: { storeId: session.user.storeId } });
        if (count === 0) {
          await tx.shiftSetting.create({
            data: {
              storeId: session.user.storeId,
              name: "Pagi",
              startTime: "07:00",
              endTime: "14:30",
            }
          });
          
          await tx.shiftSetting.create({
            data: {
              storeId: session.user.storeId,
              name: "Malam",
              startTime: "14:30",
              endTime: "22:00",
            }
          });
        }
      } else {
        // Update existing shifts
        for (let i = 0; i < shiftIds.length; i++) {
          const id = shiftIds[i];
          const dayOfWeekValue = formData.get(`dayOfWeek_${id}`);
          const isDefault = dayOfWeekValue === "all";

          await tx.shiftSetting.update({
            where: { id },
            data: {
              name: shiftNames[i],
              startTime: startTimes[i],
              endTime: endTimes[i],
              dayOfWeek: isDefault ? null : parseInt(dayOfWeekValue as string),
            }
          });
        }
      }
    });

    revalidatePath("/admin/store-settings");
    revalidatePath("/attendance");
    
    return { success: "Konfigurasi shift berhasil diperbarui!" };
  } catch (error) {
    console.error("Error updating shift settings:", error);
    return { error: "Terjadi kesalahan pada sistem." };
  }
}

export async function addShiftSetting(storeId: string) {
  try {
    await prisma.shiftSetting.create({
      data: {
        storeId,
        name: "Shift Baru",
        startTime: "07:00",
        endTime: "14:30",
        dayOfWeek: null,
      }
    });
    revalidatePath("/admin/store-settings");
    return { success: "Shift baru berhasil ditambahkan." };
  } catch (error) {
    return { error: "Gagal menambah shift." };
  }
}

export async function deleteShiftSetting(shiftId: string) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) throw new Error("Unauthorized");
    
    await prisma.shiftSetting.delete({
      where: { id: shiftId }
    });
    revalidatePath("/admin/store-settings");
    return { success: "Shift berhasil dihapus." };
  } catch (error) {
    return { error: "Gagal menghapus shift." };
  }
}

export async function updateStoreDetails(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return { error: "Akses ditolak" };
  }

  const name = formData.get("name") as string;
  const address = formData.get("address") as string;
  const timezone = formData.get("timezone") as string;

  try {
    await prisma.store.update({
      where: { id: session.user.storeId },
      data: { name, address, timezone }
    });
    revalidatePath("/admin/store-settings");
    return { success: "Detail toko berhasil diperbarui" };
  } catch (e) {
    return { error: "Gagal memperbarui toko" };
  }
}
