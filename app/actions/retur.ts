"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createReturnedItem(data: {
  supplierName: string;
  supplierId?: string;
  productName: string;
  quantity: number;
  reason?: string;
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

    if (!data.productName.trim()) {
      return { error: "Nama barang/produk harus diisi" };
    }

    if (data.quantity <= 0) {
      return { error: "Jumlah barang harus lebih besar dari 0" };
    }

    const newItem = await prisma.returnedItem.create({
      data: {
        storeId,
        supplierName: data.supplierName.trim(),
        supplierId: data.supplierId || null,
        productName: data.productName.trim(),
        quantity: data.quantity,
        reason: data.reason || null,
        status: "PENDING",
        createdById: session.user.id,
      },
    });

    revalidatePath("/retur");
    revalidatePath("/cashier/bills");
    return { success: "Barang retur berhasil dicatat!" };
  } catch (error: any) {
    console.error("Error creating returned item server action:", error);
    return { error: "Terjadi kesalahan sistem saat menyimpan barang retur." };
  }
}

export async function updateReturnedItemStatus(itemId: string, newStatus: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    
    const item = await prisma.returnedItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { error: "Barang retur tidak ditemukan" };
    }

    if (item.storeId !== storeId) {
      return { error: "Akses ditolak" };
    }

    await prisma.returnedItem.update({
      where: { id: itemId },
      data: { status: newStatus },
    });

    revalidatePath("/retur");
    revalidatePath("/cashier/bills");
    return { success: "Status barang retur berhasil diperbarui!" };
  } catch (error: any) {
    console.error("Error updating returned item status server action:", error);
    return { error: "Gagal memperbarui status barang retur." };
  }
}

export async function deleteReturnedItem(itemId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;

    const item = await prisma.returnedItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { error: "Barang retur tidak ditemukan" };
    }

    if (item.storeId !== storeId) {
      return { error: "Akses ditolak" };
    }

    await prisma.returnedItem.delete({
      where: { id: itemId },
    });

    revalidatePath("/retur");
    revalidatePath("/cashier/bills");
    return { success: "Barang retur berhasil dihapus!" };
  } catch (error: any) {
    console.error("Error deleting returned item server action:", error);
    return { error: "Gagal menghapus barang retur dari sistem." };
  }
}

export async function getReturnedItems() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized", data: [] };
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return { error: "User tidak diasosiasikan dengan toko mana pun", data: [] };
    }

    const items = await prisma.returnedItem.findMany({
      where: { storeId },
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: items };
  } catch (error: any) {
    console.error("Error fetching returned items:", error);
    return { error: "Gagal memuat daftar barang retur.", data: [] };
  }
}

export async function bulkUpdateReturnedItemStatus(itemIds: string[], newStatus: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return { error: "User tidak diasosiasikan dengan toko mana pun" };
    }

    await prisma.returnedItem.updateMany({
      where: {
        id: { in: itemIds },
        storeId,
      },
      data: { status: newStatus },
    });

    revalidatePath("/retur");
    revalidatePath("/cashier/bills");
    return { success: `Status ${itemIds.length} barang retur berhasil diperbarui!` };
  } catch (error: any) {
    console.error("Error bulk updating returned items status:", error);
    return { error: "Gagal memperbarui status barang retur secara massal." };
  }
}

export async function bulkDeleteReturnedItems(itemIds: string[]) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "Unauthorized" };
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return { error: "User tidak diasosiasikan dengan toko mana pun" };
    }

    await prisma.returnedItem.deleteMany({
      where: {
        id: { in: itemIds },
        storeId,
      },
    });

    revalidatePath("/retur");
    revalidatePath("/cashier/bills");
    return { success: `${itemIds.length} barang retur berhasil dihapus!` };
  } catch (error: any) {
    console.error("Error bulk deleting returned items:", error);
    return { error: "Gagal menghapus barang retur secara massal." };
  }
}
