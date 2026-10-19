"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { serialize, ActionResponse } from "@/lib/serialize";
import { getTZDateRange, formatTime } from "@/lib/utils";
import {
  requireUser,
  isAdminRole,
  assertSameStore,
  safeErrorMessage,
  UserFacingError,
  AccessDeniedError,
  SAFE_USER_SELECT,
} from "@/lib/auth-guard";
import { logActivity, pickChanges } from "@/lib/activity-log";

const REPORT_HEADER_FIELDS = ["status", "startingCash", "posCash", "posDebit", "billMoneyReceived", "manualCashCount", "cashierNote", "submittedAt"];
const DIGITAL_FIELDS = ["serviceType", "grossAmount", "profitAmount", "detailContact", "flipId", "isNonCash", "paymentMethod"];
const EXPENDITURE_FIELDS = ["supplierName", "amountFromBill", "amountFromCashier", "amountFromTransfer", "receiptUrl", "billId"];

/** Bandingkan daftar entri sebelum/sesudah: mana yang ditambah, diubah, dihapus. */
function diffEntries(before: any[], after: any[], fields: string[]) {
  const afterMap = new Map(after.map((e) => [e.id, e]));
  const beforeMap = new Map(before.map((e) => [e.id, e]));
  const pick = (e: any) => Object.fromEntries(["id", "createdBy", ...fields].map((f) => [f, e[f]]));

  const removed = before.filter((e) => !afterMap.has(e.id)).map(pick);
  const added = after.filter((e) => !beforeMap.has(e.id)).map(pick);
  const changed = after
    .filter((e) => beforeMap.has(e.id))
    .map((e) => ({ id: e.id, ...pickChanges(beforeMap.get(e.id), e, fields) }))
    .filter((c) => c.changed.length > 0)
    .map((c) => ({ id: c.id, before: c.before, after: c.after }));

  return { removed, added, changed, hasChanges: removed.length + added.length + changed.length > 0 };
}

// Relation includes that never expose sensitive user fields (pin hash, email)
const SAFE_REPORT_INCLUDE = {
  user: { select: SAFE_USER_SELECT },
  digitalTransactions: {
    include: { creator: { select: SAFE_USER_SELECT }, updater: { select: SAFE_USER_SELECT } },
  },
  expenditures: {
    include: { creator: { select: SAFE_USER_SELECT }, updater: { select: SAFE_USER_SELECT } },
  },
} as const;

/** Rounds a client-supplied amount; non-finite values become 0. */
function toAmount(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

const REPORT_CONFLICT_CODE = "REPORT_CONFLICT";

/** The client tried to save on top of an outdated copy of the report (stale tab/device). */
class ReportConflictError extends UserFacingError {
  constructor() {
    super("Laporan ini sudah diubah dari halaman/perangkat lain. Muat ulang halaman agar data terbaru tampil, lalu ulangi perubahan Anda.");
    this.name = "ReportConflictError";
  }
}

/**
 * Bumps the report's version (updatedAt) when its entries are changed outside the
 * cashier form, so an open cashier form with an older copy gets a conflict instead
 * of silently overwriting or resurrecting those entries.
 */
async function touchReport(tx: Prisma.TransactionClient, reportId: string) {
  await tx.shiftReport.update({ where: { id: reportId }, data: { updatedAt: new Date() } });
}

/** Keeps only string ids from a client-supplied list. */
function toIdList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
}

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
      select: { timezone: true, enableAiReceiptScan: true }
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
      include: SAFE_REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    if (!report) {
      return { 
        success: false, 
        error: "NoActiveReport",
        data: { shiftType, date: reportDate, enableAiReceiptScan: store?.enableAiReceiptScan ?? false } 
      };
    }

    return { 
      success: true, 
      data: { report: serialize(report), isReadOnly: false, timezone, enableAiReceiptScan: store?.enableAiReceiptScan ?? false } 
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
      select: { timezone: true, enableAiReceiptScan: true }
    });
    const timezone = store?.timezone || "Asia/Jakarta";

    const report = await prisma.shiftReport.findUnique({
      where: { id },
      include: SAFE_REPORT_INCLUDE,
    });

    if (!report) return { success: false, error: "Laporan tidak ditemukan" };
    
    // Security check: must be the same store, and non-admins may only open their own reports
    if (
      report.storeId !== session.user.storeId ||
      (!isAdminRole(session.user.role) && report.userId !== session.user.id)
    ) {
      return { success: false, error: "Anda tidak memiliki akses ke laporan ini" };
    }

    return { 
      success: true, 
      data: { report: serialize(report), isReadOnly: report.status === "Verified", timezone, enableAiReceiptScan: store?.enableAiReceiptScan ?? false } 
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
            },
            // Return the full report so the form never starts from an empty copy of an existing report
            include: SAFE_REPORT_INCLUDE,
            orderBy: { createdAt: 'desc' }
        });

        if (existing) return { success: true, data: { report: serialize(existing) } };

        const report = await prisma.$transaction(async (tx) => {
            const created = await tx.shiftReport.create({
                data: {
                    userId: session.user.id,
                    storeId: session.user.storeId,
                    shiftType: attendance.shiftType,
                    date: reportDate,
                    status: "Draft",
                    startingCash: 500000,
                },
                include: SAFE_REPORT_INCLUDE,
            });
            await logActivity(tx, {
                actor: session.user,
                action: "CREATE",
                entityType: "ShiftReport",
                entityId: created.id,
                summary: `Membuat laporan shift ${created.shiftType}`,
                after: { shiftType: created.shiftType, date: created.date, status: created.status, startingCash: created.startingCash },
            });
            return created;
        });

        revalidatePath("/cashier/report");
        return { success: true, data: { report: serialize(report) } };
    } catch (error: any) {
        console.error("createShiftReport error:", error);
        return { success: false, error: "Gagal membuat laporan baru" };
    }
}

export async function saveCashierReport(data: any): Promise<ActionResponse> {
    if (!data?.id || typeof data.id !== "string") return { success: false, error: "ID Laporan tidak valid" };

    try {
        const currentUser = await requireUser();
        const store = await prisma.store.findUnique({
          where: { id: currentUser.storeId },
          select: { timezone: true }
        });
        const timezone = store?.timezone || "Asia/Jakarta";

        // Optimized Transaction with higher timeout to handle pooler issues
        const newVersion = await prisma.$transaction(async (tx) => {
            const existing = await tx.shiftReport.findUnique({
                where: { id: data.id },
                include: {
                    digitalTransactions: true,
                    expenditures: true,
                }
            });

            if (!existing) throw new UserFacingError("Laporan tidak ditemukan");
            assertSameStore(existing, currentUser, "Laporan tidak ditemukan");
            if (existing.userId !== currentUser.id && !isAdminRole(currentUser.role)) {
                throw new AccessDeniedError("Anda hanya dapat mengubah laporan milik Anda sendiri.");
            }
            if (existing.status === "Verified") throw new UserFacingError("Laporan sudah diverifikasi admin dan tidak bisa diubah");

            // Optimistic concurrency: the form must be based on the latest version of the report.
            // Without this, a stale tab/device (e.g. opened before the report was filled in) could
            // overwrite a submitted report with its outdated, empty state.
            if (typeof data.baseUpdatedAt !== "string" || existing.updatedAt.toISOString() !== data.baseUpdatedAt) {
                throw new ReportConflictError();
            }

            // A submitted report can only be changed through submit/revision (isSubmit), never by a draft save
            if (existing.status === "Submitted" && !data.isSubmit) {
                throw new UserFacingError("Laporan sudah dikirim. Gunakan tombol Revisi untuk mengubahnya.");
            }

            // Server-side validation: if saving (submitting or draft), reject any empty supplier names in expenditures
            if (Array.isArray(data.expenditures)) {
                const hasEmptySupplier = data.expenditures.some((e: any) => !e.supplierName || e.supplierName.trim() === "");
                if (hasEmptySupplier) {
                    throw new UserFacingError("Nama supplier pada semua pengeluaran harus diisi");
                }
            }

            // Handle revision note
            let newCashierNote = existing.cashierNote || "";
            if (data.editReason) {
                const nowStr = new Date().toLocaleString("id-ID", { timeZone: timezone });
                newCashierNote += `\n[${nowStr}] ${currentUser.name}: ${String(data.editReason)}`;
            }

            // 1. Update ShiftReport Header
            await tx.shiftReport.update({
                where: { id: data.id },
                data: {
                    startingCash: toAmount(data.startingCash),
                    posCash: toAmount(data.posCash),
                    posDebit: toAmount(data.posDebit),
                    billMoneyReceived: toAmount(data.billMoneyReceived),
                    manualCashCount: toAmount(data.manualCashCount),
                    // A submitted report can be revised but never silently moved back to Draft
                    status: data.isSubmit || existing.status === "Submitted" ? "Submitted" : "Draft",
                    submittedAt: (data.isSubmit && !existing.submittedAt) ? new Date() : existing.submittedAt,
                    cashierNote: newCashierNote.trim(),
                }
            });

            // 2. Sync Digital Transactions (Manage Deletions first)
            if (Array.isArray(data.digitalTransactions)) {
                const incomingIds = data.digitalTransactions.map((d: any) => d.id).filter((id: any) => !!id && typeof id === 'string');

                // Only delete entries this form actually knew about and the user removed.
                // Entries added meanwhile by others (e.g. pramuniaga, bill payment) are never touched.
                const removedIds = toIdList(data.knownDigitalTransactionIds).filter((id) => !incomingIds.includes(id));
                if (removedIds.length > 0) {
                    await tx.digitalTransaction.deleteMany({
                        where: {
                            reportId: data.id,
                            id: { in: removedIds }
                        }
                    });
                }

                const existingTxMap = new Map(existing.digitalTransactions.map(t => [t.id, t]));
                for (const d of data.digitalTransactions) {
                    if (!d?.id) continue;
                    const existingTx = existingTxMap.get(d.id);

                    if (existingTx) {
                        await tx.digitalTransaction.update({
                            where: { id: d.id },
                            data: {
                                serviceType: d.serviceType || "",
                                grossAmount: toAmount(d.grossAmount),
                                profitAmount: toAmount(d.profitAmount),
                                detailContact: d.detailContact || "",
                                flipId: d.flipId || null,
                                isNonCash: !!d.isNonCash,
                                paymentMethod: d.paymentMethod || null,
                                lastUpdatedBy: existingTx.createdBy !== currentUser.id ? currentUser.id : existingTx.lastUpdatedBy
                            }
                        });
                    } else {
                        await tx.digitalTransaction.create({
                            data: {
                                id: d.id,
                                reportId: data.id,
                                createdBy: currentUser.id,
                                serviceType: d.serviceType || "",
                                grossAmount: toAmount(d.grossAmount),
                                profitAmount: toAmount(d.profitAmount),
                                detailContact: d.detailContact || "",
                                flipId: d.flipId || null,
                                isNonCash: !!d.isNonCash,
                                paymentMethod: d.paymentMethod || null,
                            }
                        });
                    }
                }
            }

            // 2.5 Sync Matching Status in FlipWebhook
            if (Array.isArray(data.digitalTransactions)) {
                const flipIds = data.digitalTransactions
                    .map((d: any) => d.flipId?.replace(/^#/, ""))
                    .filter(Boolean);
                
                if (flipIds.length > 0) {
                    await tx.flipWebhook.updateMany({
                        where: {
                            storeId: currentUser.storeId,
                            flipId: { in: flipIds }
                        },
                        data: { matched: true }
                    });
                }
            }

            // 3. Sync Expenditures (Manage Deletions first)
            if (Array.isArray(data.expenditures)) {
                const incomingIds = data.expenditures.map((e: any) => e.id).filter((id: any) => !!id && typeof id === 'string');

                // Only delete entries this form actually knew about and the user removed
                const removedIds = toIdList(data.knownExpenditureIds).filter((id) => !incomingIds.includes(id));
                if (removedIds.length > 0) {
                    await tx.expenditure.deleteMany({
                        where: {
                            reportId: data.id,
                            id: { in: removedIds }
                        }
                    });
                }

                const existingExpMap = new Map(existing.expenditures.map(e => [e.id, e]));
                for (const e of data.expenditures) {
                    if (!e?.id) continue;
                    const existingExp = existingExpMap.get(e.id);

                    if (existingExp) {
                        await tx.expenditure.update({
                            where: { id: e.id },
                            data: {
                                supplierName: e.supplierName || "",
                                amountFromBill: toAmount(e.amountFromBill),
                                amountFromCashier: toAmount(e.amountFromCashier),
                                amountFromTransfer: toAmount(e.amountFromTransfer),
                                // Persist the uploaded receipt photo (previously lost on save)
                                ...(e.receiptUrl !== undefined ? { receiptUrl: e.receiptUrl ? String(e.receiptUrl) : null } : {}),
                                lastUpdatedBy: existingExp.createdBy !== currentUser.id ? currentUser.id : existingExp.lastUpdatedBy
                            }
                        });
                    } else {
                        await tx.expenditure.create({
                            data: {
                                id: e.id,
                                reportId: data.id,
                                createdBy: currentUser.id,
                                supplierName: e.supplierName || "",
                                amountFromBill: toAmount(e.amountFromBill),
                                amountFromCashier: toAmount(e.amountFromCashier),
                                amountFromTransfer: toAmount(e.amountFromTransfer),
                                receiptUrl: e.receiptUrl ? String(e.receiptUrl) : null,
                            }
                        });
                    }
                }
            }

            // 4. Jejak audit: header + entri yang ditambah/diubah/dihapus
            const updated = await tx.shiftReport.findUniqueOrThrow({
                where: { id: data.id },
                include: { digitalTransactions: true, expenditures: true },
            });
            const header = pickChanges(existing, updated, REPORT_HEADER_FIELDS);
            const digitalDiff = diffEntries(existing.digitalTransactions, updated.digitalTransactions, DIGITAL_FIELDS);
            const expenditureDiff = diffEntries(existing.expenditures, updated.expenditures, EXPENDITURE_FIELDS);

            if (header.changed.length > 0 || digitalDiff.hasChanges || expenditureDiff.hasChanges) {
                const isSubmitting = existing.status !== "Submitted" && updated.status === "Submitted";
                const parts = [
                    header.changed.length > 0 ? `header (${header.changed.join(", ")})` : null,
                    digitalDiff.hasChanges ? `digital +${digitalDiff.added.length}/~${digitalDiff.changed.length}/-${digitalDiff.removed.length}` : null,
                    expenditureDiff.hasChanges ? `pengeluaran +${expenditureDiff.added.length}/~${expenditureDiff.changed.length}/-${expenditureDiff.removed.length}` : null,
                ].filter(Boolean);
                await logActivity(tx, {
                    actor: currentUser,
                    action: isSubmitting ? "STATUS_CHANGE" : "UPDATE",
                    entityType: "ShiftReport",
                    entityId: data.id,
                    summary: `${isSubmitting ? "Mengirim" : existing.status === "Submitted" ? "Merevisi" : "Menyimpan"} laporan shift ${existing.shiftType}: ${parts.join("; ")}`,
                    reason: data.editReason ? String(data.editReason) : null,
                    before: {
                        header: header.before,
                        digitalTransactions: { removed: digitalDiff.removed, changed: digitalDiff.changed.map((c) => ({ id: c.id, ...c.before })) },
                        expenditures: { removed: expenditureDiff.removed, changed: expenditureDiff.changed.map((c) => ({ id: c.id, ...c.before })) },
                    },
                    after: {
                        header: header.after,
                        digitalTransactions: { added: digitalDiff.added, changed: digitalDiff.changed.map((c) => ({ id: c.id, ...c.after })) },
                        expenditures: { added: expenditureDiff.added, changed: expenditureDiff.changed.map((c) => ({ id: c.id, ...c.after })) },
                    },
                });
            }

            return updated.updatedAt.toISOString();
        }, {
            maxWait: 5000,
            timeout: 10000
        });

        revalidatePath("/cashier/report");
        revalidatePath("/admin/verifications");
        revalidatePath("/cashier/history");
        // The client uses this as `baseUpdatedAt` for its next save
        return { success: true, data: { updatedAt: newVersion } };
    } catch (error: any) {
        console.error("saveCashierReport error:", error);
        return {
            success: false,
            error: safeErrorMessage(error, "Gagal menyimpan laporan"),
            ...(error instanceof ReportConflictError ? { code: REPORT_CONFLICT_CODE } : {}),
        };
    }
}

export async function addShiftEntries(
  data: {
    digitalTx: any[];
    expenditures: any[];
  },
  targetReportId: string
): Promise<ActionResponse> {
  if (!targetReportId) return { success: false, error: "Laporan shift tujuan harus ditentukan." };

  const digitalTx = Array.isArray(data?.digitalTx) ? data.digitalTx : [];
  const expenditures = Array.isArray(data?.expenditures) ? data.expenditures : [];

  if (expenditures.length > 0) {
    const hasEmptySupplier = expenditures.some((e) => !e?.supplierName || String(e.supplierName).trim() === "");
    if (hasEmptySupplier) {
      return { success: false, error: "Semua pengeluaran harus memiliki nama supplier" };
    }
  }

  try {
    const currentUser = await requireUser();
    const report = await prisma.shiftReport.findUnique({
      where: {
        id: targetReportId,
        storeId: currentUser.storeId,
        status: "Draft",
      }
    });

    if (!report) {
      return { success: false, error: "Laporan shift tujuan tidak ditemukan atau sudah tidak aktif." };
    }

    await prisma.$transaction(async (tx) => {
      const digitalRows = digitalTx.map((t) => ({
            reportId: report.id,
            createdBy: currentUser.id,
            serviceType: String(t.serviceType ?? ""),
            grossAmount: toAmount(t.grossAmount),
            profitAmount: toAmount(t.profitAmount),
            detailContact: String(t.detailContact ?? ""),
            flipId: t.flipId ? String(t.flipId) : null,
            isNonCash: !!t.isNonCash,
            paymentMethod: t.paymentMethod ? String(t.paymentMethod) : null,
          }));
      if (digitalRows.length > 0) {
        await tx.digitalTransaction.createMany({ data: digitalRows });
      }

      const expenditureRows = expenditures.map((e) => ({
            reportId: report.id,
            createdBy: currentUser.id,
            supplierName: String(e.supplierName),
            amountFromBill: toAmount(e.amountFromBill),
            amountFromCashier: toAmount(e.amountFromCashier),
            amountFromTransfer: toAmount(e.amountFromTransfer),
            receiptUrl: e.receiptUrl ? String(e.receiptUrl) : null,
          }));
      if (expenditureRows.length > 0) {
        await tx.expenditure.createMany({ data: expenditureRows });
      }

      if (digitalRows.length + expenditureRows.length > 0) {
        await logActivity(tx, {
          actor: currentUser,
          action: "CREATE",
          entityType: "ShiftReport",
          entityId: report.id,
          summary: `Menambah ${digitalRows.length} transaksi digital & ${expenditureRows.length} pengeluaran ke laporan shift ${report.shiftType}`,
          after: { digitalTransactions: digitalRows, expenditures: expenditureRows },
        });
      }
    });

    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    console.error("addShiftEntries error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal menyinkronkan data") };
  }
}

const ENTRY_REPORT_SELECT = {
  createdBy: true,
  report: { select: { storeId: true, userId: true, status: true } },
} as const;

/**
 * Ensures the current user may modify a single digital/expenditure entry:
 * same store, parent report not verified, and the user is the entry creator,
 * the report owner, or an admin. Non-admins may only touch Draft reports.
 */
function assertCanModifyEntry(
  entry: { createdBy: string | null; report: { storeId: string; userId: string; status: string } } | null,
  currentUser: { id: string; role: string; storeId: string }
) {
  if (!entry) throw new UserFacingError("Data tidak ditemukan");
  assertSameStore(entry.report, currentUser, "Data tidak ditemukan");

  const isAdmin = isAdminRole(currentUser.role);
  if (entry.report.status === "Verified") {
    throw new UserFacingError("Laporan sudah diverifikasi admin dan tidak bisa diubah");
  }
  if (!isAdmin && entry.report.status !== "Draft") {
    throw new UserFacingError("Laporan sudah dikirim. Perubahan hanya dapat dilakukan melalui revisi laporan.");
  }
  if (!isAdmin && entry.createdBy !== currentUser.id && entry.report.userId !== currentUser.id) {
    throw new AccessDeniedError("Anda hanya dapat mengubah data yang Anda buat sendiri.");
  }
}

export async function updateDigitalEntry(id: string, data: any): Promise<ActionResponse> {
  try {
    const currentUser = await requireUser();
    const entry = await prisma.digitalTransaction.findUnique({
      where: { id },
      include: { report: ENTRY_REPORT_SELECT.report },
    });
    assertCanModifyEntry(entry, currentUser);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.digitalTransaction.update({
        where: { id },
        data: {
          serviceType: data.serviceType,
          grossAmount: toAmount(data.grossAmount),
          profitAmount: toAmount(data.profitAmount),
          detailContact: data.detailContact,
          flipId: data.flipId,
          isNonCash: !!data.isNonCash,
          paymentMethod: data.paymentMethod,
          lastUpdatedBy: currentUser.id
        }
      });
      const diff = pickChanges(entry, updated, DIGITAL_FIELDS);
      if (diff.changed.length > 0) {
        await logActivity(tx, {
          actor: currentUser,
          action: "UPDATE",
          entityType: "DigitalTransaction",
          entityId: id,
          summary: `Mengubah transaksi digital ${entry!.serviceType} (${diff.changed.join(", ")})`,
          before: { reportId: entry!.reportId, ...diff.before },
          after: diff.after,
        });
      }
      await touchReport(tx, entry!.reportId);
    });
    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    console.error("updateDigitalEntry error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal memperbarui data") };
  }
}

export async function updateExpenditureEntry(id: string, data: any): Promise<ActionResponse> {
  try {
    const currentUser = await requireUser();
    const entry = await prisma.expenditure.findUnique({
      where: { id },
      include: { report: ENTRY_REPORT_SELECT.report },
    });
    assertCanModifyEntry(entry, currentUser);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.expenditure.update({
        where: { id },
        data: {
          supplierName: data.supplierName,
          amountFromBill: toAmount(data.amountFromBill),
          amountFromCashier: toAmount(data.amountFromCashier),
          amountFromTransfer: toAmount(data.amountFromTransfer),
          lastUpdatedBy: currentUser.id
        }
      });
      const diff = pickChanges(entry, updated, EXPENDITURE_FIELDS);
      if (diff.changed.length > 0) {
        await logActivity(tx, {
          actor: currentUser,
          action: "UPDATE",
          entityType: "Expenditure",
          entityId: id,
          summary: `Mengubah pengeluaran ${entry!.supplierName} (${diff.changed.join(", ")})`,
          before: { reportId: entry!.reportId, ...diff.before },
          after: diff.after,
        });
      }
      await touchReport(tx, entry!.reportId);
    });
    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    console.error("updateExpenditureEntry error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal memperbarui data") };
  }
}

export async function deleteShiftEntry(type: "digital" | "expenditure", id: string): Promise<ActionResponse> {
  try {
    const currentUser = await requireUser();

    if (type === "digital") {
      const entry = await prisma.digitalTransaction.findUnique({
        where: { id },
        include: { report: ENTRY_REPORT_SELECT.report },
      });
      assertCanModifyEntry(entry, currentUser);
      await prisma.$transaction(async (tx) => {
        await tx.digitalTransaction.delete({ where: { id } });
        await touchReport(tx, entry!.reportId);
        await logActivity(tx, {
          actor: currentUser,
          action: "DELETE",
          entityType: "DigitalTransaction",
          entityId: id,
          summary: `Menghapus transaksi digital ${entry!.serviceType} Rp${entry!.grossAmount}`,
          before: entry,
        });
      });
    } else {
      const entry = await prisma.expenditure.findUnique({
        where: { id },
        include: { report: ENTRY_REPORT_SELECT.report },
      });
      assertCanModifyEntry(entry, currentUser);
      await prisma.$transaction(async (tx) => {
        await tx.expenditure.delete({ where: { id } });
        await touchReport(tx, entry!.reportId);
        await logActivity(tx, {
          actor: currentUser,
          action: "DELETE",
          entityType: "Expenditure",
          entityId: id,
          summary: `Menghapus pengeluaran ${entry!.supplierName}`,
          before: entry,
        });
      });
    }
    revalidatePath("/cashier/report");
    revalidatePath("/pramuniaga/entries");
    return { success: true };
  } catch (error: any) {
    console.error("deleteShiftEntry error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal menghapus data") };
  }
}

export async function deleteShiftReport(reportId: string): Promise<ActionResponse> {
  try {
    const currentUser = await requireUser();

    // Only Admin or Super Admin can delete reports
    if (!isAdminRole(currentUser.role)) {
      return { success: false, error: "Hanya Admin yang dapat menghapus laporan" };
    }

    // Snapshot lengkap (termasuk entri yang ikut terhapus via cascade) untuk jejak audit
    const report = await prisma.shiftReport.findUnique({
      where: { id: reportId },
      include: {
        user: { select: SAFE_USER_SELECT },
        digitalTransactions: true,
        expenditures: true,
        financialTransactions: true,
      },
    });
    assertSameStore(report, currentUser, "Laporan tidak ditemukan");

    await prisma.$transaction(async (tx) => {
      await tx.shiftReport.delete({
        where: { id: reportId }
      });
      await logActivity(tx, {
        actor: currentUser,
        action: "DELETE",
        entityType: "ShiftReport",
        entityId: reportId,
        summary: `Menghapus laporan shift ${report.shiftType} ${report.date.toISOString().split("T")[0]} milik ${report.user.name} (status ${report.status})`,
        before: report,
      });
    });

    revalidatePath("/cashier/history");
    revalidatePath("/admin/verifications");
    return { success: true };
  } catch (error: any) {
    console.error("deleteShiftReport error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal menghapus laporan") };
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
        digitalTransactions: SAFE_REPORT_INCLUDE.digitalTransactions,
        expenditures: SAFE_REPORT_INCLUDE.expenditures,
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

export async function getActiveCashierReports(): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user?.storeId) return { success: false, error: "Unauthorized", data: [] };
  const storeId = session.user.storeId;

  try {
    // Find all users who are currently clocked in (active attendance) in this store
    const activeAttendances = await prisma.attendance.findMany({
      where: {
        storeId,
        clockOut: null,
      },
      select: {
        userId: true,
        shiftType: true,
      }
    });

    if (activeAttendances.length === 0) {
      return { success: true, data: [] };
    }

    const activeUserIds = activeAttendances.map(a => a.userId);

    // Find draft reports for these active users
    const activeReports = await prisma.shiftReport.findMany({
      where: {
        storeId,
        status: "Draft",
        userId: { in: activeUserIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        }
      }
    });

    return { success: true, data: serialize(activeReports) };
  } catch (error: any) {
    console.error("getActiveCashierReports error:", error);
    return { success: false, error: "Gagal mengambil daftar laporan kasir aktif", data: [] };
  }
}
