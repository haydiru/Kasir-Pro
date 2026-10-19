"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getTZDateRange } from "@/lib/utils";
import { logActivity } from "@/lib/activity-log";

const BILL_LOG_FIELDS = ["supplierName", "supplierId", "dueDate", "amount", "status", "calendarEventId", "createdById"] as const;
function billSnapshot(bill: Record<string, any>) {
  return Object.fromEntries(BILL_LOG_FIELDS.map((f) => [f, bill[f]]));
}

// Helper untuk mendapatkan Google Access Token yang valid (menyegarkan jika kedaluwarsa)
async function getGoogleAccessToken(storeId: string): Promise<string | null> {
  const googleAuth = await prisma.storeGoogleAuth.findUnique({
    where: { storeId_type: { storeId, type: "CALENDAR" } },
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
      where: { storeId_type: { storeId, type: "CALENDAR" } },
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

    if (!data.supplierName?.trim()) {
      return { error: "Nama supplier harus diisi" };
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Nominal harus lebih besar dari 0" };
    }

    const parsedDueDate = new Date(data.dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return { error: "Tanggal jatuh tempo tidak valid" };
    }

    // Supplier (optional) must belong to the same store
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, storeId },
        select: { id: true },
      });
      if (!supplier) {
        return { error: "Supplier tidak ditemukan" };
      }
    }

    // 1. Simpan tagihan di Database Lokal
    const newBill = await prisma.$transaction(async (tx) => {
      const created = await tx.bill.create({
        data: {
          storeId,
          supplierName: data.supplierName.trim(),
          supplierId: data.supplierId || null,
          dueDate: parsedDueDate,
          amount,
          status: "BELUM_BAYAR",
          createdById: session.user.id,
        },
      });
      await logActivity(tx, {
        actor: session.user,
        action: "CREATE",
        entityType: "Bill",
        entityId: created.id,
        summary: `Mencatat tagihan ${created.supplierName} Rp${created.amount}`,
        after: billSnapshot(created),
      });
      return created;
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

const BILL_STATUSES = ["LUNAS", "BELUM_BAYAR"];

export async function updateBillStatus(
  billId: string,
  newStatus: string,
  paymentAmounts?: {
    cashier: number;
    bill: number;
    transfer: number;
  },
  targetReportId?: string
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

    if (!BILL_STATUSES.includes(newStatus)) {
      return { error: "Status tagihan tidak valid" };
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

    const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";

    // Validate everything BEFORE changing the bill, so a rejected request never
    // leaves the bill marked LUNAS without its expenditure (or vice versa).
    let lunasPayload: { reportId: string; cashier: number; bill: number; transfer: number } | null = null;

    if (newStatus === "LUNAS") {
      if (!paymentAmounts) {
        return { error: "Detail jumlah pembayaran harus diisi" };
      }
      if (!targetReportId) {
        return { error: "Laporan shift tujuan harus ditentukan." };
      }

      const cashier = Number(paymentAmounts.cashier || 0);
      const fromBill = Number(paymentAmounts.bill || 0);
      const transfer = Number(paymentAmounts.transfer || 0);
      if ([cashier, fromBill, transfer].some((n) => !Number.isFinite(n) || n < 0)) {
        return { error: "Nominal pembayaran tidak valid" };
      }
      // Allocation must match the bill amount exactly (same rule as the payment form)
      if (Math.abs(cashier + fromBill + transfer - bill.amount) >= 0.01) {
        return { error: "Total alokasi pembayaran harus sama dengan nominal tagihan" };
      }

      // Cari draft laporan shift aktif
      const report = await prisma.shiftReport.findUnique({
        where: {
          id: targetReportId,
          storeId,
          status: "Draft",
        }
      });

      if (!report) {
        return { error: "Laporan shift tujuan tidak ditemukan atau sudah tidak aktif." };
      }

      lunasPayload = { reportId: report.id, cashier, bill: fromBill, transfer };
    } else if (newStatus === "BELUM_BAYAR") {
      // Un-paying removes the linked expenditures; never allow that once they are
      // part of a verified report, and only admins may touch submitted reports.
      const linkedExpenditures = await prisma.expenditure.findMany({
        where: { billId },
        select: { report: { select: { status: true } } },
      });
      if (linkedExpenditures.some((e) => e.report.status === "Verified")) {
        return { error: "Pembayaran tagihan sudah tercatat di laporan yang diverifikasi dan tidak bisa dibatalkan." };
      }
      if (!isAdmin && linkedExpenditures.some((e) => e.report.status !== "Draft")) {
        return { error: "Pembayaran tagihan sudah tercatat di laporan yang dikirim. Hubungi Admin untuk membatalkan." };
      }
    }

    // 1. Update status tagihan lokal
    const updatedBill = await prisma.$transaction(async (tx) => {
      const updated = await tx.bill.update({
        where: { id: billId },
        data: { status: newStatus },
      });

      // Jejak audit: pengeluaran yang akan dihapus disimpan lengkap sebelum dihapus
      const removedExpenditures = newStatus === "BELUM_BAYAR"
        ? await tx.expenditure.findMany({ where: { billId } })
        : [];

      // 3. Integrasi ke Laporan Shift Aktif
      if (lunasPayload) {
        // Cari apakah sudah pernah dicatat di shift ini untuk mencegah duplikasi
        const existingExpenditure = await tx.expenditure.findFirst({
          where: { billId }
        });

        if (!existingExpenditure) {
          await tx.expenditure.create({
            data: {
              reportId: lunasPayload.reportId,
              createdBy: session.user.id,
              supplierName: bill.supplierName,
              amountFromCashier: lunasPayload.cashier,
              amountFromBill: lunasPayload.bill,
              amountFromTransfer: lunasPayload.transfer,
              billId: bill.id,
            }
          });
          // Bump the report version so an open cashier form reloads instead of missing this entry
          await tx.shiftReport.update({ where: { id: lunasPayload.reportId }, data: { updatedAt: new Date() } });
        }
      } else if (newStatus === "BELUM_BAYAR") {
        // Hapus pengeluaran terkait jika tagihan dibatalkan menjadi belum lunas
        await tx.expenditure.deleteMany({
          where: { billId }
        });
        // Bump affected report versions so an open cashier form does not re-create the removed entry
        const affectedReportIds = [...new Set(removedExpenditures.map((e) => e.reportId))];
        if (affectedReportIds.length > 0) {
          await tx.shiftReport.updateMany({ where: { id: { in: affectedReportIds } }, data: { updatedAt: new Date() } });
        }
      }

      await logActivity(tx, {
        actor: session.user,
        action: "STATUS_CHANGE",
        entityType: "Bill",
        entityId: billId,
        summary: `Status tagihan ${bill.supplierName} Rp${bill.amount}: ${bill.status} → ${newStatus}` +
          (removedExpenditures.length > 0 ? ` (${removedExpenditures.length} pengeluaran terkait dihapus)` : ""),
        before: { status: bill.status, removedExpenditures },
        after: { status: newStatus, payment: lunasPayload },
      });

      return updated;
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

    // Only admins, or the employee who recorded an unpaid bill, may delete it
    const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
    const isOwnUnpaidBill = bill.createdById === session.user.id && bill.status === "BELUM_BAYAR";
    if (!isAdmin && !isOwnUnpaidBill) {
      return { error: "Hanya Admin yang dapat menghapus tagihan ini." };
    }

    // 1. Hapus event Google Calendar jika ada
    if (bill.calendarEventId) {
      await deleteCalendarEvent(storeId, bill.calendarEventId);
    }

    // 2. Hapus tagihan dari database
    await prisma.$transaction(async (tx) => {
      await tx.bill.delete({
        where: { id: billId },
      });
      await logActivity(tx, {
        actor: session.user,
        action: "DELETE",
        entityType: "Bill",
        entityId: billId,
        summary: `Menghapus tagihan ${bill.supplierName} Rp${bill.amount} (${bill.status})`,
        before: billSnapshot(bill),
      });
    });

    revalidatePath("/cashier/bills");
    return { success: "Tagihan berhasil dihapus!" };
  } catch (error: any) {
    console.error("Error deleting bill server action:", error);
    return { error: "Gagal menghapus tagihan dari sistem." };
  }
}

export async function rescheduleBill(billId: string, newDueDate: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return { error: "Store not associated" };
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      return { error: "Tagihan tidak ditemukan" };
    }

    if (bill.storeId !== storeId) {
      return { error: "Akses ditolak" };
    }

    const parsedDueDate = new Date(newDueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return { error: "Tanggal jatuh tempo tidak valid" };
    }

    // 1. Update bill due date
    const updatedBill = await prisma.$transaction(async (tx) => {
      const u = await tx.bill.update({
        where: { id: billId },
        data: { dueDate: parsedDueDate },
      });
      await logActivity(tx, {
        actor: session.user,
        action: "UPDATE",
        entityType: "Bill",
        entityId: billId,
        summary: `Mengubah jatuh tempo tagihan ${bill.supplierName}`,
        before: { dueDate: bill.dueDate },
        after: { dueDate: parsedDueDate },
      });
      return u;
    });

    // 2. Update Google Calendar event if it exists
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

    revalidatePath("/cashier/bills");
    return { success: "Tanggal jatuh tempo berhasil diubah!" };
  } catch (error: any) {
    console.error("Error rescheduling bill:", error);
    return { error: "Gagal memperbarui jadwal jatuh tempo." };
  }
}
