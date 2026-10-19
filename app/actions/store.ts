"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, safeErrorMessage, UserFacingError } from "@/lib/auth-guard";
import { logActivity, pickChanges } from "@/lib/activity-log";

const SHIFT_LOG_SELECT = { id: true, name: true, startTime: true, endTime: true, autoCheckoutTime: true, dayOfWeek: true } as const;

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export async function updateShiftSettings(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    return { error: "Akses ditolak. Hanya Admin yang dapat mengubah pengaturan ini." };
  }

  const shiftIds = formData.getAll("shiftId") as string[];
  const shiftNames = formData.getAll("shiftName") as string[];
  const startTimes = formData.getAll("startTime") as string[];
  const endTimes = formData.getAll("endTime") as string[];
  const autoCheckoutTimes = formData.getAll("autoCheckoutTime") as string[];

  try {
    // If no shifts are provided, we might be initializing or just deleting all.
    // However, the user specifically mentioned defaults: 07:00-14:30 and 14:30-22:00.
    
    // We handle the update/create in a transaction
    await prisma.$transaction(async (tx) => {
      const shiftsBefore = await tx.shiftSetting.findMany({
        where: { storeId: session.user.storeId },
        select: SHIFT_LOG_SELECT,
        orderBy: { createdAt: "asc" },
      });

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
              autoCheckoutTime: "18:00",
            }
          });
          
          await tx.shiftSetting.create({
            data: {
              storeId: session.user.storeId,
              name: "Malam",
              startTime: "14:30",
              endTime: "22:00",
              autoCheckoutTime: "23:30",
            }
          });
        }
      } else {
        // Update existing shifts
        for (let i = 0; i < shiftIds.length; i++) {
          const id = shiftIds[i];
          const dayOfWeekValue = formData.get(`dayOfWeek_${id}`);
          const isDefault = !dayOfWeekValue || dayOfWeekValue === "all";
          const dayOfWeek = isDefault ? null : parseInt(dayOfWeekValue as string, 10);

          if (!TIME_PATTERN.test(startTimes[i] || "") || !TIME_PATTERN.test(endTimes[i] || "")) {
            throw new UserFacingError("Format jam shift tidak valid (gunakan HH:MM).");
          }
          if (autoCheckoutTimes[i] && !TIME_PATTERN.test(autoCheckoutTimes[i])) {
            throw new UserFacingError("Format jam auto-checkout tidak valid (gunakan HH:MM).");
          }
          if (dayOfWeek !== null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
            throw new UserFacingError("Hari shift tidak valid.");
          }

          // storeId filter prevents editing shifts that belong to another store
          const result = await tx.shiftSetting.updateMany({
            where: { id, storeId: session.user.storeId },
            data: {
              name: shiftNames[i],
              startTime: startTimes[i],
              endTime: endTimes[i],
              autoCheckoutTime: autoCheckoutTimes[i] || null,
              dayOfWeek,
            }
          });
          if (result.count === 0) {
            throw new UserFacingError("Shift tidak ditemukan atau bukan milik toko Anda.");
          }
        }
      }

      const shiftsAfter = await tx.shiftSetting.findMany({
        where: { storeId: session.user.storeId },
        select: SHIFT_LOG_SELECT,
        orderBy: { createdAt: "asc" },
      });
      if (JSON.stringify(shiftsBefore) !== JSON.stringify(shiftsAfter)) {
        await logActivity(tx, {
          actor: session.user,
          action: "SETTING_CHANGE",
          entityType: "ShiftSetting",
          summary: "Mengubah konfigurasi shift",
          before: shiftsBefore,
          after: shiftsAfter,
        });
      }
    });

    revalidatePath("/admin/store-settings");
    revalidatePath("/attendance");
    
    return { success: "Konfigurasi shift berhasil diperbarui!" };
  } catch (error) {
    console.error("Error updating shift settings:", error);
    return { error: safeErrorMessage(error, "Terjadi kesalahan pada sistem.") };
  }
}

// The shift is always created for the logged-in admin's own store (never a client-supplied id).
export async function addShiftSetting() {
  try {
    const admin = await requireAdmin();
    await prisma.$transaction(async (tx) => {
      const shift = await tx.shiftSetting.create({
        data: {
          storeId: admin.storeId,
          name: "Shift Baru",
          startTime: "07:00",
          endTime: "14:30",
          dayOfWeek: null,
        },
        select: SHIFT_LOG_SELECT,
      });
      await logActivity(tx, {
        actor: admin,
        action: "SETTING_CHANGE",
        entityType: "ShiftSetting",
        entityId: shift.id,
        summary: "Menambah shift baru",
        after: shift,
      });
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
    
    await prisma.$transaction(async (tx) => {
      const shift = await tx.shiftSetting.findFirst({
        where: { id: shiftId, storeId: session.user.storeId },
        select: SHIFT_LOG_SELECT,
      });
      if (!shift) throw new Error("Shift not found in this store");
      await tx.shiftSetting.delete({ where: { id: shiftId } });
      await logActivity(tx, {
        actor: session.user,
        action: "SETTING_CHANGE",
        entityType: "ShiftSetting",
        entityId: shiftId,
        summary: `Menghapus shift ${shift.name}`,
        before: shift,
      });
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
    // Reject unknown IANA zones: an invalid value would break every Intl call for the store
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { error: "Zona waktu tidak valid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.store.findUnique({
        where: { id: session.user.storeId },
        select: { name: true, address: true, timezone: true },
      });
      await tx.store.update({
        where: { id: session.user.storeId },
        data: { name, address, timezone }
      });
      const diff = pickChanges(before, { name, address, timezone });
      if (diff.changed.length > 0) {
        await logActivity(tx, {
          actor: session.user,
          action: "SETTING_CHANGE",
          entityType: "Store",
          entityId: session.user.storeId,
          summary: `Mengubah detail toko (${diff.changed.join(", ")})`,
          before: diff.before,
          after: diff.after,
        });
      }
    });
    revalidatePath("/admin/store-settings");
    return { success: "Detail toko berhasil diperbarui" };
  } catch (e) {
    return { error: "Gagal memperbarui toko" };
  }
}

export async function toggleAiReceiptScan(enabled: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.storeId || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
      return { success: false, error: "Akses ditolak" };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.store.findUnique({
        where: { id: session.user.storeId },
        select: { enableAiReceiptScan: true },
      });
      const u = await tx.store.update({
        where: { id: session.user.storeId },
        data: { enableAiReceiptScan: !!enabled },
      });
      if (before?.enableAiReceiptScan !== u.enableAiReceiptScan) {
        await logActivity(tx, {
          actor: session.user,
          action: "SETTING_CHANGE",
          entityType: "Store",
          entityId: session.user.storeId,
          summary: `${u.enableAiReceiptScan ? "Mengaktifkan" : "Menonaktifkan"} fitur scan nota AI`,
          before: { enableAiReceiptScan: before?.enableAiReceiptScan },
          after: { enableAiReceiptScan: u.enableAiReceiptScan },
        });
      }
      return u;
    });

    revalidatePath("/admin/store-settings");
    revalidatePath("/cashier/report");
    revalidatePath("/shopping-funds");

    return {
      success: true,
      enabled: updated.enableAiReceiptScan,
      message: enabled
        ? "Fitur ekstraksi nota AI (GPT Luna) berhasil diaktifkan. Kasir kini wajib foto nota saat belanja."
        : "Fitur ekstraksi nota AI dinonaktifkan. Pengunggahan foto nota kembali opsional.",
    };
  } catch (error: any) {
    console.error("toggleAiReceiptScan error:", error);
    return { success: false, error: "Gagal memperbarui status fitur AI nota" };
  }
}

