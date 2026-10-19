"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize, ActionResponse } from "@/lib/serialize";
import { requireAdmin, requireUser, safeErrorMessage } from "@/lib/auth-guard";
import { logActivity, pickChanges } from "@/lib/activity-log";

const PRODUCT_FIELDS = ["name", "itemCode", "barcode", "stock", "costPrice", "sellingPrice", "unit", "category", "isActive"];

export async function getProducts(params?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { success: false, error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    const search = params?.search?.trim() || "";
    const category = params?.category?.trim() || "";
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(10, params?.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      storeId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { itemCode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          priceHistory: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: serialize({
        products,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      }),
    };
  } catch (error: any) {
    console.error("getProducts error:", error);
    return { success: false, error: "Gagal memuat data barang" };
  }
}

export async function getProductById(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const product = await prisma.product.findFirst({
      where: { id, storeId: session.user.storeId },
      include: {
        priceHistory: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) return { success: false, error: "Barang tidak ditemukan" };

    return { success: true, data: serialize(product) };
  } catch (error: any) {
    console.error("getProductById error:", error);
    return { success: false, error: "Gagal mengambil rincian barang" };
  }
}

export async function createProduct(input: {
  itemCode?: string;
  barcode?: string;
  name: string;
  stock?: number;
  costPrice: number;
  sellingPrice: number;
  unit?: string;
  category?: string;
}): Promise<ActionResponse> {
  try {
    // Only admins may change master data (prices & stock)
    const admin = await requireAdmin();

    const storeId = admin.storeId;
    const name = input.name?.trim();
    if (!name) return { success: false, error: "Nama barang wajib diisi" };

    const costPrice = Math.max(0, Number(input.costPrice) || 0);
    const sellingPrice = Math.max(0, Number(input.sellingPrice) || 0);
    const stock = Math.trunc(Number(input.stock)) || 0;
    const barcode = input.barcode?.trim() || null;
    const itemCode = input.itemCode?.trim() || null;
    const unit = input.unit?.trim() || "PCS";
    const category = input.category?.trim() || null;

    // Cek duplikasi barcode di toko ini jika barcode diisi
    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: { storeId, barcode, isActive: true },
      });
      if (existing) {
        return { success: false, error: `Barcode ${barcode} sudah digunakan oleh ${existing.name}` };
      }
    }

    const product = await prisma.$transaction(async (tx) => {
     const created = await tx.product.create({
      data: {
        storeId,
        itemCode,
        barcode,
        name,
        stock,
        costPrice,
        sellingPrice,
        unit,
        category,
        priceHistory: {
          create: {
            oldCostPrice: costPrice,
            newCostPrice: costPrice,
            oldSellingPrice: sellingPrice,
            newSellingPrice: sellingPrice,
            difference: 0,
            percentage: 0,
            sourceType: "MANUAL_EDIT",
            reason: "Input Barang Awal",
            changedById: admin.id,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: admin.id,
          },
        },
      },
     });
     await logActivity(tx, {
       actor: admin,
       action: "CREATE",
       entityType: "Product",
       entityId: created.id,
       summary: `Menambah barang ${created.name}`,
       after: Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, (created as any)[f]])),
     });
     return created;
    });

    revalidatePath("/products");
    return { success: true, data: serialize(product) };
  } catch (error: any) {
    console.error("createProduct error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal menambahkan barang baru") };
  }
}

export async function updateProduct(
  id: string,
  input: {
    itemCode?: string;
    barcode?: string;
    name: string;
    stock?: number;
    costPrice: number;
    sellingPrice: number;
    unit?: string;
    category?: string;
    reason?: string;
  }
): Promise<ActionResponse> {
  try {
    // Only admins may change master data (prices & stock)
    const admin = await requireAdmin();

    const storeId = admin.storeId;
    const existing = await prisma.product.findFirst({
      where: { id, storeId },
    });

    if (!existing) return { success: false, error: "Barang tidak ditemukan" };

    const name = input.name?.trim() || existing.name;
    const costPrice = input.costPrice !== undefined ? Math.max(0, Number(input.costPrice) || 0) : existing.costPrice;
    const sellingPrice = input.sellingPrice !== undefined ? Math.max(0, Number(input.sellingPrice) || 0) : existing.sellingPrice;
    const stock = input.stock !== undefined ? Math.trunc(Number(input.stock)) || 0 : existing.stock;
    const barcode = input.barcode !== undefined ? (input.barcode?.trim() || null) : existing.barcode;
    const itemCode = input.itemCode !== undefined ? (input.itemCode?.trim() || null) : existing.itemCode;
    const unit = input.unit?.trim() || existing.unit;
    const category = input.category !== undefined ? (input.category?.trim() || null) : existing.category;

    // Cek apakah ada perubahan harga
    const costChanged = existing.costPrice !== costPrice;
    const sellingChanged = existing.sellingPrice !== sellingPrice;
    const isPriceHike = costPrice > existing.costPrice;

    const diff = costPrice - existing.costPrice;
    const pct = existing.costPrice > 0 ? (diff / existing.costPrice) * 100 : 0;

    // Update produk dan jika harga berubah catat riwayat
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          name,
          costPrice,
          sellingPrice,
          stock,
          barcode,
          itemCode,
          unit,
          category,
        },
      });

      if (costChanged || sellingChanged) {
        await tx.productPriceHistory.create({
          data: {
            productId: id,
            oldCostPrice: existing.costPrice,
            newCostPrice: costPrice,
            oldSellingPrice: existing.sellingPrice,
            newSellingPrice: sellingPrice,
            difference: diff,
            percentage: Number(pct.toFixed(2)),
            sourceType: "MANUAL_EDIT",
            reason: input.reason || (isPriceHike ? "Penyesuaian Kenaikan Harga Modal" : "Perubahan Harga"),
            changedById: admin.id,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: admin.id,
          },
        });
      }

      const changes = pickChanges(existing, p, PRODUCT_FIELDS);
      if (changes.changed.length > 0) {
        await logActivity(tx, {
          actor: admin,
          action: "UPDATE",
          entityType: "Product",
          entityId: id,
          summary: `Mengubah barang ${existing.name} (${changes.changed.join(", ")})`,
          before: changes.before,
          after: changes.after,
          reason: input.reason || null,
        });
      }

      return p;
    });

    revalidatePath("/products");
    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("updateProduct error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal memperbarui barang") };
  }
}

export async function deleteProduct(id: string): Promise<ActionResponse> {
  try {
    const admin = await requireAdmin();

    const storeId = admin.storeId;
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, storeId } });
      if (!product || !product.isActive) return;
      await tx.product.update({
        where: { id },
        data: { isActive: false },
      });
      await logActivity(tx, {
        actor: admin,
        action: "DELETE",
        entityType: "Product",
        entityId: id,
        summary: `Menonaktifkan (hapus) barang ${product.name}`,
        before: Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, (product as any)[f]])),
        after: { isActive: false },
      });
    });

    revalidatePath("/products");
    return { success: true };
  } catch (error: any) {
    console.error("deleteProduct error:", error);
    return { success: false, error: safeErrorMessage(error, "Gagal menghapus barang") };
  }
}

export async function confirmPriceAdjustment(historyId: string): Promise<ActionResponse> {
  try {
    const user = await requireUser();

    // The price history entry must belong to a product of the user's own store
    const history = await prisma.productPriceHistory.findFirst({
      where: { id: historyId, product: { storeId: user.storeId } },
      include: { product: { select: { name: true } } },
    });
    if (!history) return { success: false, error: "Riwayat harga tidak ditemukan" };

    const updated = await prisma.$transaction(async (tx) => {
      const h = await tx.productPriceHistory.update({
        where: { id: historyId },
        data: {
          isConfirmed: true,
          confirmedAt: new Date(),
          confirmedById: user.id,
        },
      });
      await logActivity(tx, {
        actor: user,
        action: "STATUS_CHANGE",
        entityType: "ProductPriceHistory",
        entityId: historyId,
        summary: `Konfirmasi penyesuaian harga ${history.product.name}: modal ${history.oldCostPrice} → ${history.newCostPrice}`,
        before: { isConfirmed: history.isConfirmed },
        after: { isConfirmed: true },
      });
      return h;
    });

    revalidatePath("/products");
    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("confirmPriceAdjustment error:", error);
    return { success: false, error: "Gagal mengonfirmasi penyesuaian harga" };
  }
}

export async function getPriceHikeAlerts(limit = 10): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const storeId = session.user.storeId;
    const unconfirmedHikes = await prisma.productPriceHistory.findMany({
      where: {
        product: { storeId, isActive: true },
        difference: { gt: 0 },
        isConfirmed: false,
      },
      include: {
        product: true,
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, Math.trunc(Number(limit)) || 10), 100),
    });

    return { success: true, data: serialize(unconfirmedHikes) };
  } catch (error: any) {
    console.error("getPriceHikeAlerts error:", error);
    return { success: false, error: "Gagal memuat notifikasi kenaikan harga" };
  }
}
