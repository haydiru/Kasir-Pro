"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize, ActionResponse } from "@/lib/serialize";

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
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const storeId = session.user.storeId;
    const name = input.name?.trim();
    if (!name) return { success: false, error: "Nama barang wajib diisi" };

    const costPrice = Math.max(0, Number(input.costPrice) || 0);
    const sellingPrice = Math.max(0, Number(input.sellingPrice) || 0);
    const stock = Number(input.stock) || 0;
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

    const product = await prisma.product.create({
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
            changedById: session.user.id,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: session.user.id,
          },
        },
      },
    });

    revalidatePath("/products");
    return { success: true, data: serialize(product) };
  } catch (error: any) {
    console.error("createProduct error:", error);
    return { success: false, error: error.message || "Gagal menambahkan barang baru" };
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
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const storeId = session.user.storeId;
    const existing = await prisma.product.findFirst({
      where: { id, storeId },
    });

    if (!existing) return { success: false, error: "Barang tidak ditemukan" };

    const name = input.name?.trim() || existing.name;
    const costPrice = Math.max(0, Number(input.costPrice) || 0);
    const sellingPrice = Math.max(0, Number(input.sellingPrice) || 0);
    const stock = input.stock !== undefined ? Number(input.stock) : existing.stock;
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
            changedById: session.user.id,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: session.user.id,
          },
        });
      }

      return p;
    });

    revalidatePath("/products");
    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("updateProduct error:", error);
    return { success: false, error: error.message || "Gagal memperbarui barang" };
  }
}

export async function deleteProduct(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const storeId = session.user.storeId;
    await prisma.product.updateMany({
      where: { id, storeId },
      data: { isActive: false },
    });

    revalidatePath("/products");
    return { success: true };
  } catch (error: any) {
    console.error("deleteProduct error:", error);
    return { success: false, error: "Gagal menghapus barang" };
  }
}

export async function confirmPriceAdjustment(historyId: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const updated = await prisma.productPriceHistory.update({
      where: { id: historyId },
      data: {
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedById: session.user.id,
      },
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
      take: limit,
    });

    return { success: true, data: serialize(unconfirmedHikes) };
  } catch (error: any) {
    console.error("getPriceHikeAlerts error:", error);
    return { success: false, error: "Gagal memuat notifikasi kenaikan harga" };
  }
}
