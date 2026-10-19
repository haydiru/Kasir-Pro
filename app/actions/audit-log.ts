"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdminRole } from "@/lib/auth-guard";
import { serialize, ActionResponse } from "@/lib/serialize";
import { getTZDateRange } from "@/lib/utils";

const PAGE_SIZE = 50;

export interface ActivityLogFilters {
  /** YYYY-MM-DD, zona waktu toko */
  from?: string;
  /** YYYY-MM-DD, zona waktu toko (inklusif) */
  to?: string;
  actorId?: string;
  entityType?: string;
  action?: string;
  entityId?: string;
  page?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Hanya admin/super_admin, dan hanya log milik tokonya sendiri. Read-only:
// tidak ada aksi update/delete untuk ActivityLog di aplikasi ini.
export async function getActivityLogs(filters: ActivityLogFilters = {}): Promise<ActionResponse> {
  // Role & toko dibaca ulang dari database, bukan dari JWT
  const admin = await getCurrentUser();
  if (!admin) return { success: false, error: "Unauthorized" };
  if (!isAdminRole(admin.role)) return { success: false, error: "Forbidden" };
  const storeId = admin.storeId;

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { timezone: true } });
    const timezone = store?.timezone || "Asia/Jakarta";

    const where: Prisma.ActivityLogWhereInput = { storeId };

    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from && DATE_RE.test(filters.from)) {
      createdAt.gte = getTZDateRange(new Date(`${filters.from}T12:00:00Z`), timezone).start;
    }
    if (filters.to && DATE_RE.test(filters.to)) {
      createdAt.lte = getTZDateRange(new Date(`${filters.to}T12:00:00Z`), timezone).end;
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

    if (typeof filters.actorId === "string" && filters.actorId && filters.actorId !== "all") where.actorId = filters.actorId;
    if (typeof filters.entityType === "string" && filters.entityType && filters.entityType !== "all") where.entityType = filters.entityType;
    if (typeof filters.action === "string" && filters.action && filters.action !== "all") where.action = filters.action;
    if (typeof filters.entityId === "string" && filters.entityId.trim()) where.entityId = filters.entityId.trim();

    const page = Math.min(Math.max(1, Math.floor(Number(filters.page) || 1)), 10_000);

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      success: true,
      data: serialize({ logs, total, page, pageSize: PAGE_SIZE, timezone }),
    };
  } catch (error) {
    console.error("getActivityLogs error:", error);
    return { success: false, error: "Gagal memuat log aktivitas" };
  }
}

/** Opsi filter: daftar user toko & tipe entitas yang pernah tercatat. */
export async function getActivityLogFilterOptions(): Promise<ActionResponse> {
  // Role & toko dibaca ulang dari database, bukan dari JWT
  const admin = await getCurrentUser();
  if (!admin) return { success: false, error: "Unauthorized" };
  if (!isAdminRole(admin.role)) return { success: false, error: "Forbidden" };
  const storeId = admin.storeId;

  try {
    const [users, entityTypes, actions] = await Promise.all([
      prisma.user.findMany({
        where: { storeId },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
      prisma.activityLog.groupBy({ by: ["entityType"], where: { storeId } }),
      prisma.activityLog.groupBy({ by: ["action"], where: { storeId } }),
    ]);

    return {
      success: true,
      data: {
        users,
        entityTypes: entityTypes.map((e) => e.entityType).sort(),
        actions: actions.map((a) => a.action).sort(),
      },
    };
  } catch (error) {
    console.error("getActivityLogFilterOptions error:", error);
    return { success: false, error: "Gagal memuat opsi filter" };
  }
}
