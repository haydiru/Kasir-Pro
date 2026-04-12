"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Determines current shift based on store settings and server time.
 */
async function getCurrentShift(storeId: string) {
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

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

export async function getOrCreateActiveReport() {
  const session = await auth();
  if (!session?.user?.storeId) throw new Error("Unauthorized");

  const shiftType = await getCurrentShift(session.user.storeId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find existing draft
  let report = await prisma.shiftReport.findFirst({
    where: {
      storeId: session.user.storeId,
      shiftType: shiftType,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
      status: "Draft",
    },
    include: {
      digitalTransactions: { include: { creator: true, updater: true } },
      expenditures: { include: { creator: true, updater: true } },
    },
  });

  if (!report) {
    // Check if any report at all for today/shift (maybe already submitted?)
    const existingSubmitted = await prisma.shiftReport.findFirst({
        where: {
          storeId: session.user.storeId,
          shiftType: shiftType,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          digitalTransactions: { include: { creator: true, updater: true } },
          expenditures: { include: { creator: true, updater: true } },
        },
    });
    
    if (existingSubmitted) return { report: existingSubmitted, isReadOnly: true };

    // Create new Draft
    report = await prisma.shiftReport.create({
      data: {
        userId: session.user.id,
        storeId: session.user.storeId,
        shiftType: shiftType,
        status: "Draft",
        startingCash: 500000, // Default starting cash
      },
      include: {
        digitalTransactions: { include: { creator: true, updater: true } },
        expenditures: { include: { creator: true, updater: true } },
      },
    });
  }

  return { report, isReadOnly: false };
}

export async function addShiftEntries(data: {
  digitalTx: any[];
  expenditures: any[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const { report, isReadOnly } = await getOrCreateActiveReport();
  if (isReadOnly) return { error: "Laporan untuk shift ini sudah di-submit dan tidak bisa diubah." };

  try {
    await prisma.$transaction(async (tx) => {
      // Add digital transactions
      if (data.digitalTx.length > 0) {
        await tx.digitalTransaction.createMany({
          data: data.digitalTx.map((t) => ({
            reportId: report.id,
            createdBy: session.user.id,
            serviceType: t.serviceType,
            grossAmount: t.grossAmount,
            profitAmount: t.profitAmount,
            detailContact: t.detailContact,
            flipId: t.flipId,
            isNonCash: t.isNonCash,
            paymentMethod: t.paymentMethod,
          })),
        });
      }

      // Add expenditures
      if (data.expenditures.length > 0) {
        await tx.expenditure.createMany({
          data: data.expenditures.map((e) => ({
            reportId: report.id,
            createdBy: session.user.id,
            supplierName: e.supplierName,
            amountFromBill: e.amountFromBill,
            amountFromCashier: e.amountFromCashier,
            amountFromTransfer: e.amountFromTransfer,
            receiptUrl: e.receiptUrl,
          })),
        });
      }
    });

    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Gagal menyinkronkan data." };
  }
}

export async function updateDigitalEntry(id: string, data: any) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const existing = await prisma.digitalTransaction.findUnique({
        where: { id }
    });

    if (!existing) throw new Error("Data tidak ditemukan");
    
    // Permission check: Creator or Cashier/Admin can edit
    const isCreator = existing.createdBy === session.user.id;
    const isManager = session.user.role === "cashier" || session.user.role === "admin" || session.user.role === "super_admin";
    
    if (!isCreator && !isManager) throw new Error("Tidak memiliki izin untuk mengubah data ini");

    await prisma.digitalTransaction.update({
        where: { id },
        data: {
            serviceType: data.serviceType,
            grossAmount: data.grossAmount,
            profitAmount: data.profitAmount,
            detailContact: data.detailContact,
            flipId: data.flipId,
            isNonCash: data.isNonCash,
            paymentMethod: data.paymentMethod,
            lastUpdatedBy: !isCreator ? session.user.id : existing.lastUpdatedBy
        }
    });

    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
}

export async function updateExpenditureEntry(id: string, data: any) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const existing = await prisma.expenditure.findUnique({
        where: { id }
    });

    if (!existing) throw new Error("Data tidak ditemukan");
    
    const isCreator = existing.createdBy === session.user.id;
    const isManager = session.user.role === "cashier" || session.user.role === "admin" || session.user.role === "super_admin";
    
    if (!isCreator && !isManager) throw new Error("Tidak memiliki izin untuk mengubah data ini");

    await prisma.expenditure.update({
        where: { id },
        data: {
            supplierName: data.supplierName,
            amountFromBill: data.amountFromBill,
            amountFromCashier: data.amountFromCashier,
            amountFromTransfer: data.amountFromTransfer,
            lastUpdatedBy: !isCreator ? session.user.id : existing.lastUpdatedBy
        }
    });

    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
}

export async function deleteShiftEntry(type: "digital" | "expenditure", id: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    let existing;
    if (type === "digital") {
        existing = await prisma.digitalTransaction.findUnique({ where: { id } });
    } else {
        existing = await prisma.expenditure.findUnique({ where: { id } });
    }

    if (!existing) throw new Error("Data tidak ditemukan");
    
    // Deletion is stricter: only creator or admin
    const isCreator = existing.createdBy === session.user.id;
    const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
    
    if (!isCreator && !isAdmin) throw new Error("Hanya pembuat atau Admin yang dapat menghapus data permanen");

    if (type === "digital") {
        await prisma.digitalTransaction.delete({ where: { id } });
    } else {
        await prisma.expenditure.delete({ where: { id } });
    }

    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
}

export async function saveCashierReport(data: any) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update ShiftReport Header
            await tx.shiftReport.update({
                where: { id: data.id },
                data: {
                    startingCash: data.startingCash,
                    posCash: data.posCash,
                    posDebit: data.posDebit,
                    billMoneyReceived: data.billMoneyReceived,
                    manualCashCount: data.manualCashCount,
                    status: data.isSubmit ? "Submitted" : "Draft",
                    submittedAt: data.isSubmit ? new Date() : null,
                }
            });

            // 2. Update Digital Transactions
            if (data.digitalTransactions) {
                for (const d of data.digitalTransactions) {
                    // Check if anything changed and who is editing
                    const existing = await tx.digitalTransaction.findUnique({
                        where: { id: d.id }
                    });

                    if (existing) {
                        const isChanged = 
                            existing.serviceType !== d.serviceType ||
                            existing.grossAmount !== d.grossAmount ||
                            existing.profitAmount !== d.profitAmount ||
                            existing.detailContact !== d.detailContact ||
                            existing.flipId !== d.flipId ||
                            existing.isNonCash !== d.isNonCash ||
                            existing.paymentMethod !== d.paymentMethod;

                        if (isChanged) {
                            await tx.digitalTransaction.update({
                                where: { id: d.id },
                                data: {
                                    serviceType: d.serviceType,
                                    grossAmount: d.grossAmount,
                                    profitAmount: d.profitAmount,
                                    detailContact: d.detailContact,
                                    flipId: d.flipId,
                                    isNonCash: d.isNonCash,
                                    paymentMethod: d.paymentMethod,
                                    lastUpdatedBy: existing.createdBy !== session.user.id ? session.user.id : existing.lastUpdatedBy
                                }
                            });
                        }
                    } else if (!data.isSubmit) {
                        // Handle adding new rows from Cashier UI (if any)
                        await tx.digitalTransaction.create({
                            data: {
                                id: d.id, // Use the client-generated ID
                                reportId: data.id,
                                createdBy: session.user.id,
                                serviceType: d.serviceType,
                                grossAmount: d.grossAmount,
                                profitAmount: d.profitAmount,
                                detailContact: d.detailContact,
                                flipId: d.flipId,
                                isNonCash: d.isNonCash,
                                paymentMethod: d.paymentMethod,
                            }
                        });
                    }
                }
            }

            // 3. Update Expenditures
            if (data.expenditures) {
                for (const e of data.expenditures) {
                    const existing = await tx.expenditure.findUnique({
                        where: { id: e.id }
                    });

                    if (existing) {
                        const isChanged = 
                            existing.supplierName !== e.supplierName ||
                            existing.amountFromBill !== e.amountFromBill ||
                            existing.amountFromCashier !== e.amountFromCashier ||
                            existing.amountFromTransfer !== e.amountFromTransfer;

                        if (isChanged) {
                            await tx.expenditure.update({
                                where: { id: e.id },
                                data: {
                                    supplierName: e.supplierName,
                                    amountFromBill: e.amountFromBill,
                                    amountFromCashier: e.amountFromCashier,
                                    amountFromTransfer: e.amountFromTransfer,
                                    lastUpdatedBy: existing.createdBy !== session.user.id ? session.user.id : existing.lastUpdatedBy
                                }
                            });
                        }
                    } else if (!data.isSubmit) {
                        await tx.expenditure.create({
                            data: {
                                id: e.id,
                                reportId: data.id,
                                createdBy: session.user.id,
                                supplierName: e.supplierName,
                                amountFromBill: e.amountFromBill,
                                amountFromCashier: e.amountFromCashier,
                                amountFromTransfer: e.amountFromTransfer,
                            }
                        });
                    }
                }
            }

            // Note: We might want to handle deletion of rows that are removed in UI
            // But let's keep it simple as requested for now.
        });

        revalidatePath("/cashier/report");
        revalidatePath("/admin/verifications");
        return { success: true };
    } catch (error) {
        return { error: "Gagal menyimpan laporan." };
    }
}
