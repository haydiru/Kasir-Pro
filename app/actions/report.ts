"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize, ActionResponse } from "@/lib/serialize";
import { getTZDateRange, formatTime } from "@/lib/utils";

/**
 * Determines current shift based on store settings and server time.
 */
async function getCurrentShift(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { timezone: true }
  });
  const timeZone = store?.timezone || "Asia/Jakarta";

  const now = new Date();
  // Get local hours and minutes
  const localStr = now.toLocaleString("en-US", { timeZone, hour12: false });
  const timeMatch = localStr.match(/(\d+):(\d+):(\d+)/);
  if (!timeMatch) return "Pagi";

  const localH = parseInt(timeMatch[1]);
  const localM = parseInt(timeMatch[2]);
  const currentTotalMinutes = localH * 60 + localM;

  const settings = await prisma.shiftSetting.findMany({
    where: { storeId },
  });

  for (const shift of settings) {
    const [startH, startM] = shift.startTime.split(":").map(Number);
    const [endH, endM] = shift.endTime.split(":").map(Number);
    
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (startMin < endMin) {
      if (currentTotalMinutes >= startMin && currentTotalMinutes < endMin) {
        return shift.name;
      }
    } else {
      // Overnight shift (e.g., 22:00 - 06:00)
      if (currentTotalMinutes >= startMin || currentTotalMinutes < endMin) {
        return shift.name;
      }
    }
  }

  return "Pagi"; // Default fallback
}

export async function getActiveReport(): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId },
      select: { timezone: true }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    // 1. Get current active attendance
    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: session.user.id,
            clockOut: null
        }
    });

    if (!attendance) {
        return { success: false, error: "AttendanceRequired" };
    }

    const shiftType = attendance.shiftType;
    const reportDate = attendance.clockIn;
    
    // Correct way: use TZ Date Range based on clockIn time
    const { start, end } = getTZDateRange(reportDate, timezone);

    // 2. Find existing report for this USER + STORE + SHIFT + ATTENDANCE DATE RANGE
    const report = await prisma.shiftReport.findFirst({
      where: {
        userId: session.user.id,
        storeId: session.user.storeId,
        shiftType: shiftType,
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        user: true,
        digitalTransactions: { include: { creator: true, updater: true } },
        expenditures: { include: { creator: true, updater: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!report) {
      return { 
        success: false, 
        error: "NoActiveReport",
        data: { shiftType, date: reportDate } 
      };
    }

    return { 
      success: true, 
      data: { report: serialize(report), isReadOnly: false, timezone } 
    };
  } catch (error: any) {
    console.error("getActiveReport error:", error);
    return { success: false, error: "Gagal memuat laporan" };
  }
}

export async function getReportById(id: string): Promise<ActionResponse> {
  if (!id) return { success: false, error: "ID Laporan diperlukan" };
  
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const store = await prisma.store.findUnique({
      where: { id: session.user.storeId },
      select: { timezone: true }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    const report = await prisma.shiftReport.findUnique({
      where: { id },
      include: {
        user: true,
        digitalTransactions: { include: { creator: true, updater: true } },
        expenditures: { include: { creator: true, updater: true } },
      },
    });

    if (!report) return { success: false, error: "Laporan tidak ditemukan" };
    
    // Security check: must be the same store
    if (report.storeId !== session.user.storeId) {
      return { success: false, error: "Anda tidak memiliki akses ke laporan ini" };
    }

    return { 
      success: true, 
      data: { report: serialize(report), isReadOnly: report.status === "Verified", timezone } 
    };
  } catch (error: any) {
    console.error("getReportById error:", error);
    return { success: false, error: "Gagal memuat laporan" };
  }
}

export async function createShiftReport(): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

        const store = await prisma.store.findUnique({
          where: { id: session.user.storeId },
          select: { timezone: true }
        });
        const timezone = store?.timezone || "Asia/Jakarta";

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId: session.user.id,
                clockOut: null
            }
        });

        if (!attendance) return { success: false, error: "Harap lakukan absensi terlebih dahulu." };

        const reportDate = attendance.clockIn;
        const { start, end } = getTZDateRange(reportDate, timezone);
        
        // Double check if report already exists to avoid duplicates
        const existing = await prisma.shiftReport.findFirst({
            where: {
                userId: session.user.id,
                storeId: session.user.storeId,
                shiftType: attendance.shiftType,
                date: {
                    gte: start,
                    lt: end
                }
            }
        });

        if (existing) return { success: true, data: { report: serialize(existing) } };

        const report = await prisma.shiftReport.create({
            data: {
                userId: session.user.id,
                storeId: session.user.storeId,
                shiftType: attendance.shiftType,
                date: reportDate,
                status: "Draft",
                startingCash: 500000,
            },
            include: {
                user: true,
                digitalTransactions: { include: { creator: true, updater: true } },
                expenditures: { include: { creator: true, updater: true } },
            },
        });

        revalidatePath("/cashier/report");
        return { success: true, data: { report: serialize(report) } };
    } catch (error: any) {
        console.error("createShiftReport error:", error);
        return { success: false, error: "Gagal membuat laporan baru" };
    }
}

export async function saveCashierReport(data: any): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!data?.id) return { success: false, error: "ID Laporan tidak valid" };

    try {
        const store = await prisma.store.findUnique({
          where: { id: session.user.storeId },
          select: { timezone: true }
        });
        const timezone = store?.timezone || "Asia/Jakarta";

        // Optimized Transaction with higher timeout to handle pooler issues
        await prisma.$transaction(async (tx) => {
            const existing = await tx.shiftReport.findUnique({
                where: { id: data.id },
                include: {
                    digitalTransactions: { select: { id: true, createdBy: true, lastUpdatedBy: true } },
                    expenditures: { select: { id: true, createdBy: true, lastUpdatedBy: true } }
                }
            });

            if (!existing) throw new Error("Laporan tidak ditemukan");
            if (existing.status === "Verified") throw new Error("Laporan sudah diverifikasi admin dan tidak bisa diubah");

            // Handle revision note
            let newCashierNote = existing.cashierNote || "";
            if (data.editReason) {
                const nowStr = new Date().toLocaleString("id-ID", { timeZone: timezone });
                newCashierNote += `\n[${nowStr}] ${session.user.name}: ${data.editReason}`;
            }

            // 1. Update ShiftReport Header
            await tx.shiftReport.update({
                where: { id: data.id },
                data: {
                    startingCash: Math.round(data.startingCash || 0),
                    posCash: Math.round(data.posCash || 0),
                    posDebit: Math.round(data.posDebit || 0),
                    billMoneyReceived: Math.round(data.billMoneyReceived || 0),
                    manualCashCount: Math.round(data.manualCashCount || 0),
                    status: data.isSubmit ? "Submitted" : data.isReadOnly ? existing.status : "Draft",
                    submittedAt: (data.isSubmit && !existing.submittedAt) ? new Date() : existing.submittedAt,
                    cashierNote: newCashierNote.trim(),
                }
            });

            // 2. Sync Digital Transactions (Manage Deletions first)
            if (Array.isArray(data.digitalTransactions)) {
                const incomingIds = data.digitalTransactions.map((d: any) => d.id).filter((id: any) => !!id && typeof id === 'string');
                
                // Delete entries in DB for this report that are NOT in the incoming payload
                await tx.digitalTransaction.deleteMany({
                    where: {
                        reportId: data.id,
                        id: { notIn: incomingIds }
                    }
                });

                const existingTxMap = new Map(existing.digitalTransactions.map(t => [t.id, t]));
                for (const d of data.digitalTransactions) {
                    if (!d?.id) continue;
                    const existingTx = existingTxMap.get(d.id);

                    if (existingTx) {
                        await tx.digitalTransaction.update({
                            where: { id: d.id },
                            data: {
                                serviceType: d.serviceType || "",
                                grossAmount: Math.round(d.grossAmount || 0),
                                profitAmount: Math.round(d.profitAmount || 0),
                                detailContact: d.detailContact || "",
                                flipId: d.flipId || null,
                                isNonCash: !!d.isNonCash,
                                paymentMethod: d.paymentMethod || null,
                                lastUpdatedBy: existingTx.createdBy !== session.user.id ? session.user.id : existingTx.lastUpdatedBy
                            }
                        });
                    } else {
                        await tx.digitalTransaction.create({
                            data: {
                                id: d.id,
                                reportId: data.id,
                                createdBy: session.user.id,
                                serviceType: d.serviceType || "",
                                grossAmount: Math.round(d.grossAmount || 0),
                                profitAmount: Math.round(d.profitAmount || 0),
                                detailContact: d.detailContact || "",
                                flipId: d.flipId || null,
                                isNonCash: !!d.isNonCash,
                                paymentMethod: d.paymentMethod || null,
                            }
                        });
                    }
                }
            }

            // 3. Sync Expenditures (Manage Deletions first)
            if (Array.isArray(data.expenditures)) {
                const incomingIds = data.expenditures.map((e: any) => e.id).filter((id: any) => !!id && typeof id === 'string');
                
                // Delete entries in DB for this report that are NOT in the incoming payload
                await tx.expenditure.deleteMany({
                    where: {
                        reportId: data.id,
                        id: { notIn: incomingIds }
                    }
                });

                const existingExpMap = new Map(existing.expenditures.map(e => [e.id, e]));
                for (const e of data.expenditures) {
                    if (!e?.id) continue;
                    const existingExp = existingExpMap.get(e.id);

                    if (existingExp) {
                        await tx.expenditure.update({
                            where: { id: e.id },
                            data: {
                                supplierName: e.supplierName || "",
                                amountFromBill: Math.round(e.amountFromBill || 0),
                                amountFromCashier: Math.round(e.amountFromCashier || 0),
                                amountFromTransfer: Math.round(e.amountFromTransfer || 0),
                                lastUpdatedBy: existingExp.createdBy !== session.user.id ? session.user.id : existingExp.lastUpdatedBy
                            }
                        });
                    } else {
                        await tx.expenditure.create({
                            data: {
                                id: e.id,
                                reportId: data.id,
                                createdBy: session.user.id,
                                supplierName: e.supplierName || "",
                                amountFromBill: Math.round(e.amountFromBill || 0),
                                amountFromCashier: Math.round(e.amountFromCashier || 0),
                                amountFromTransfer: Math.round(e.amountFromTransfer || 0),
                            }
                        });
                    }
                }
            }
        }, {
            maxWait: 5000,
            timeout: 10000
        });

        revalidatePath("/cashier/report");
        revalidatePath("/admin/verifications");
        revalidatePath("/cashier/history");
        return { success: true };
    } catch (error: any) {
        console.error("saveCashierReport error:", error);
        return { success: false, error: error.message || "Gagal menyimpan laporan" };
    }
}

// These are still used by Pramuniaga Entries, let's standardize them too
export async function addShiftEntries(data: {
  digitalTx: any[];
  expenditures: any[];
}): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const res = await getActiveReport();
    if (!res.success || !res.data) throw new Error(res.error);
    
    const { report } = res.data;

    await prisma.$transaction(async (tx) => {
      if (data.digitalTx.length > 0) {
        await tx.digitalTransaction.createMany({
          data: data.digitalTx.map((t) => ({
            reportId: report.id,
            createdBy: session.user.id,
            serviceType: t.serviceType,
            grossAmount: Math.round(t.grossAmount),
            profitAmount: Math.round(t.profitAmount),
            detailContact: t.detailContact,
            flipId: t.flipId,
            isNonCash: t.isNonCash,
            paymentMethod: t.paymentMethod,
          })),
        });
      }

      if (data.expenditures.length > 0) {
        await tx.expenditure.createMany({
          data: data.expenditures.map((e) => ({
            reportId: report.id,
            createdBy: session.user.id,
            supplierName: e.supplierName,
            amountFromBill: Math.round(e.amountFromBill),
            amountFromCashier: Math.round(e.amountFromCashier),
            amountFromTransfer: Math.round(e.amountFromTransfer),
            receiptUrl: e.receiptUrl,
          })),
        });
      }
    });

    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyinkronkan data" };
  }
}

export async function updateDigitalEntry(id: string, data: any): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await prisma.digitalTransaction.update({
      where: { id },
      data: {
        serviceType: data.serviceType,
        grossAmount: Math.round(data.grossAmount),
        profitAmount: Math.round(data.profitAmount),
        detailContact: data.detailContact,
        flipId: data.flipId,
        isNonCash: data.isNonCash,
        paymentMethod: data.paymentMethod,
        lastUpdatedBy: session.user.id
      }
    });
    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui data" };
  }
}

export async function updateExpenditureEntry(id: string, data: any): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await prisma.expenditure.update({
      where: { id },
      data: {
        supplierName: data.supplierName,
        amountFromBill: Math.round(data.amountFromBill),
        amountFromCashier: Math.round(data.amountFromCashier),
        amountFromTransfer: Math.round(data.amountFromTransfer),
        lastUpdatedBy: session.user.id
      }
    });
    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui data" };
  }
}

export async function deleteShiftEntry(type: "digital" | "expenditure", id: string): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    if (type === "digital") {
      await prisma.digitalTransaction.delete({ where: { id } });
    } else {
      await prisma.expenditure.delete({ where: { id } });
    }
    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus data" };
  }
}

export async function deleteShiftReport(reportId: string): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  
  // Only Admin or Super Admin can delete reports
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { success: false, error: "Hanya Admin yang dapat menghapus laporan" };
  }

  try {
    await prisma.shiftReport.delete({
      where: { id: reportId }
    });
    
    revalidatePath("/cashier/history");
    revalidatePath("/admin/verifications");
    return { success: true };
  } catch (error: any) {
    console.error("deleteShiftReport error:", error);
    return { success: false, error: "Gagal menghapus laporan" };
  }
}
export async function getShiftTeamEntries(): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };
  const storeId = session.user.storeId;

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    const shiftType = await getCurrentShift(storeId);
    const { start, end } = getTZDateRange(new Date(), timezone);

    // Find all reports for this shift today in this store
    const reports = await prisma.shiftReport.findMany({
      where: {
        storeId: storeId,
        shiftType: shiftType,
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        digitalTransactions: { include: { creator: true, updater: true } },
        expenditures: { include: { creator: true, updater: true } },
      },
    });

    // Merge transactions and expenditures from all reports
    const digitalTransactions = reports.flatMap(r => r.digitalTransactions);
    const expenditures = reports.flatMap(r => r.expenditures);

    return { 
      success: true, 
      data: serialize({ digitalTransactions, expenditures }) 
    };
  } catch (error: any) {
    console.error("getShiftTeamEntries error:", error);
    return { success: false, error: "Gagal mengambil data riwayat tim" };
  }
}
