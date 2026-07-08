"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getTZDateRange } from "@/lib/utils";

// Helper untuk mendapatkan Google Access Token yang valid (menyegarkan jika kedaluwarsa)
async function getGoogleAccessToken(storeId: string): Promise<string | null> {
  const googleAuth = await prisma.storeGoogleAuth.findUnique({
    where: { storeId },
  });

  if (!googleAuth) return null;

  // Cek apakah token kedaluwarsa (tambahkan buffer 5 menit)
  const isExpired = new Date(googleAuth.expiryDate).getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return googleAuth.accessToken;
  }

  // Refresh token
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      console.warn("Google credentials are not configured in .env for refresh flow");
      return null;
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: googleAuth.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("Gagal melakukan refresh token Google:", await res.text());
      return null;
    }

    const data = await res.json();
    const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await prisma.storeGoogleAuth.update({
      where: { storeId },
      data: {
        accessToken: data.access_token,
        expiryDate,
      },
    });

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing Google Access Token:", error);
    return null;
  }
}

// Helper: Buat Event di Google Calendar
async function createCalendarEvent(
  storeId: string,
  supplierName: string,
  amount: number,
  dueDate: Date
): Promise<string | null> {
  const token = await getGoogleAccessToken(storeId);
  if (!token) return null;

  const startStr = dueDate.toISOString().split("T")[0];
  // Event all-day Google Calendar bersifat eksklusif untuk tanggal selesai
  const nextDay = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);
  const endStr = nextDay.toISOString().split("T")[0];

  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `[Tagihan] ${supplierName}`,
        description: `Tagihan supplier sebesar Rp ${amount.toLocaleString("id-ID")}. Status: BELUM BAYAR.`,
        start: { date: startStr },
        end: { date: endStr },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.id as string;
    } else {
      console.error("Gagal membuat event kalender:", await res.text());
    }
  } catch (error) {
    console.error("Error membuat event kalender:", error);
  }
  return null;
}

// Helper: Update Event di Google Calendar
async function updateCalendarEvent(
  storeId: string,
  eventId: string,
  supplierName: string,
  amount: number,
  dueDate: Date,
  status: string
): Promise<void> {
  const token = await getGoogleAccessToken(storeId);
  if (!token) return;

  const startStr = dueDate.toISOString().split("T")[0];
  const nextDay = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);
  const endStr = nextDay.toISOString().split("T")[0];

  const prefix = status === "LUNAS" ? "[LUNAS] " : "";
  const statusLabel = status === "LUNAS" ? "LUNAS" : "BELUM BAYAR";

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `${prefix}[Tagihan] ${supplierName}`,
        description: `Tagihan supplier sebesar Rp ${amount.toLocaleString("id-ID")}. Status: ${statusLabel}.`,
        start: { date: startStr },
        end: { date: endStr },
      }),
    });

    if (!res.ok) {
      console.warn("Gagal memperbarui event kalender:", await res.text());
    }
  } catch (error) {
    console.error("Error memperbarui event kalender:", error);
  }
}

// Helper: Hapus Event di Google Calendar
async function deleteCalendarEvent(storeId: string, eventId: string): Promise<void> {
  const token = await getGoogleAccessToken(storeId);
  if (!token) return;

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      console.warn("Gagal menghapus event kalender:", await res.text());
    }
  } catch (error) {
    console.error("Error menghapus event kalender:", error);
  }
}

// --- Server Actions ---

export async function createBill(data: {
  supplierName: string;
  supplierId?: string;
  dueDate: string; // ISO Date String
  amount: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return { error: "User tidak diasosiasikan dengan toko mana pun" };
    }

    if (!data.supplierName.trim()) {
      return { error: "Nama supplier harus diisi" };
    }

    if (data.amount <= 0) {
      return { error: "Nominal harus lebih besar dari 0" };
    }

    const parsedDueDate = new Date(data.dueDate);

    // 1. Simpan tagihan di Database Lokal
    const newBill = await prisma.bill.create({
      data: {
        storeId,
        supplierName: data.supplierName.trim(),
        supplierId: data.supplierId || null,
        dueDate: parsedDueDate,
        amount: data.amount,
        status: "BELUM_BAYAR",
        createdById: session.user.id,
      },
    });

    // 2. Sinkronisasi ke Google Calendar jika terhubung
    const calendarEventId = await createCalendarEvent(
      storeId,
      newBill.supplierName,
      newBill.amount,
      newBill.dueDate
    );

    if (calendarEventId) {
      // Update data tagihan lokal dengan event ID kalender
      await prisma.bill.update({
        where: { id: newBill.id },
        data: { calendarEventId },
      });
    }

    revalidatePath("/cashier/bills");
    return { success: "Tagihan baru berhasil dicatat!" };
  } catch (error: any) {
    console.error("Error creating bill server action:", error);
    return { error: "Terjadi kesalahan sistem saat menyimpan tagihan." };
  }
}

export async function updateBillStatus(
  billId: string,
  newStatus: string,
  paymentSource?: "CASHIER" | "BILL" | "TRANSFER"
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return { error: "Store not associated" };
    }
    
    // Cari tagihan
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      return { error: "Tagihan tidak ditemukan" };
    }

    if (bill.storeId !== storeId) {
      return { error: "Akses ditolak" };
    }

    // 1. Update status tagihan lokal
    const updatedBill = await prisma.bill.update({
      where: { id: billId },
      data: { status: newStatus },
    });

    // 2. Update event Google Calendar jika tercatat
    if (updatedBill.calendarEventId) {
      await updateCalendarEvent(
        storeId,
        updatedBill.calendarEventId,
        updatedBill.supplierName,
        updatedBill.amount,
        updatedBill.dueDate,
        updatedBill.status
      );
    }

    // 3. Integrasi ke Laporan Shift Aktif
    if (newStatus === "LUNAS") {
      if (!paymentSource) {
        return { error: "Sumber dana pembayaran harus dipilih" };
      }

      // Cari active attendance untuk user ini
      const attendance = await prisma.attendance.findFirst({
        where: {
          userId: session.user.id,
          clockOut: null
        }
      });

      if (attendance) {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { timezone: true }
        });
        const timezone = store?.timezone || "Asia/Jakarta";
        const { start, end } = getTZDateRange(attendance.clockIn, timezone);

        // Cari draft laporan shift aktif untuk user & shift ini
        const report = await prisma.shiftReport.findFirst({
          where: {
            userId: session.user.id,
            storeId,
            shiftType: attendance.shiftType,
            date: {
              gte: start,
              lt: end,
            },
          }
        });

        if (report) {
          // Cari apakah sudah pernah dicatat di shift ini untuk mencegah duplikasi
          const existingExpenditure = await prisma.expenditure.findFirst({
            where: { billId }
          });

          if (!existingExpenditure) {
            await prisma.expenditure.create({
              data: {
                reportId: report.id,
                createdBy: session.user.id,
                supplierName: bill.supplierName,
                amountFromCashier: paymentSource === "CASHIER" ? bill.amount : 0,
                amountFromBill: paymentSource === "BILL" ? bill.amount : 0,
                amountFromTransfer: paymentSource === "TRANSFER" ? bill.amount : 0,
                billId: bill.id,
              }
            });
          }
        }
      }
    } else if (newStatus === "BELUM_BAYAR") {
      // Hapus pengeluaran terkait jika tagihan dibatalkan menjadi belum lunas
      await prisma.expenditure.deleteMany({
        where: { billId }
      });
    }

    revalidatePath("/cashier/bills");
    revalidatePath("/cashier/report");
    return { success: "Status tagihan berhasil diperbarui!" };
  } catch (error: any) {
    console.error("Error updating bill status server action:", error);
    return { error: "Gagal memperbarui status tagihan." };
  }
}

export async function deleteBill(billId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      return { error: "Tagihan tidak ditemukan" };
    }

    if (bill.storeId !== storeId) {
      return { error: "Akses ditolak" };
    }

    // 1. Hapus event Google Calendar jika ada
    if (bill.calendarEventId) {
      await deleteCalendarEvent(storeId, bill.calendarEventId);
    }

    // 2. Hapus tagihan dari database
    await prisma.bill.delete({
      where: { id: billId },
    });

    revalidatePath("/cashier/bills");
    return { success: "Tagihan berhasil dihapus!" };
  } catch (error: any) {
    console.error("Error deleting bill server action:", error);
    return { error: "Gagal menghapus tagihan dari sistem." };
  }
}
