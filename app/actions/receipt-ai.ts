"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { extractReceiptWithOpenRouter } from "@/lib/openrouter";
import { serialize, ActionResponse } from "@/lib/serialize";

/**
 * Fuzzy similarity helper
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  if (s1 === s2) return 1.0;

  const words1 = s1.split(/\s+/).filter(Boolean);
  const words2 = s2.split(/\s+/).filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return 0;

  let common = 0;
  for (const w1 of words1) {
    if (words2.some((w2) => w2.includes(w1) || w1.includes(w2))) {
      common++;
    }
  }

  return (2 * common) / (words1.length + words2.length);
}

export async function scanReceiptWithAi(
  receiptUrl: string,
  options?: {
    expenditureId?: string;
    shoppingExpenseId?: string;
    bypassToggle?: boolean;
  }
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const storeId = session.user.storeId;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { enableAiReceiptScan: true },
    });

    if (!store?.enableAiReceiptScan && !options?.bypassToggle) {
      return {
        success: false,
        error: "Fitur ekstraksi nota AI belum diaktifkan di Pengaturan Toko.",
      };
    }

    if (!receiptUrl) {
      return { success: false, error: "URL gambar nota tidak ditemukan." };
    }

    // 1. Panggil OpenRouter Vision AI (GPT Luna)
    const aiResult = await extractReceiptWithOpenRouter(receiptUrl);
    if (!aiResult.success || !aiResult.data) {
      return { success: false, error: aiResult.error || "Gagal mengekstrak struk nota." };
    }

    const { supplierName, invoiceDate, totalAmount, items } = aiResult.data;

    // 2. Ambil seluruh master barang toko yang aktif untuk pencocokan
    const storeProducts = await prisma.product.findMany({
      where: { storeId, isActive: true },
      select: {
        id: true,
        itemCode: true,
        barcode: true,
        name: true,
        costPrice: true,
        sellingPrice: true,
        unit: true,
      },
    });

    // 3. Simpan record ReceiptAiScan
    const scan = await prisma.receiptAiScan.create({
      data: {
        storeId,
        expenditureId: options?.expenditureId || null,
        shoppingExpenseId: options?.shoppingExpenseId || null,
        receiptUrl,
        supplierName: supplierName || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        totalAmount: totalAmount || 0,
        status: "COMPLETED",
        createdById: session.user.id,
      },
    });

    let priceHikesDetected = 0;
    const scannedItemsToCreate = [];

    // 4. Lakukan pencocokan (3-Tier Matcher) untuk setiap item nota
    for (const it of items) {
      let matchedProduct = null;
      let matchStatus = "UNMATCHED";

      // Tier 1: Cek Barcode persis jika ada
      if (it.barcodeOrCode) {
        matchedProduct = storeProducts.find(
          (p) =>
            (p.barcode && p.barcode === it.barcodeOrCode) ||
            (p.itemCode && p.itemCode === it.barcodeOrCode)
        );
      }

      // Tier 2: Cek Nama persis
      if (!matchedProduct) {
        matchedProduct = storeProducts.find(
          (p) => p.name.toLowerCase() === it.rawName.toLowerCase()
        );
      }

      // Tier 3: Fuzzy similarity jika kemiripan >= 0.70
      if (!matchedProduct) {
        let bestScore = 0;
        let bestCandidate = null;

        for (const p of storeProducts) {
          const score = calculateSimilarity(it.rawName, p.name);
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = p;
          }
        }

        if (bestCandidate && bestScore >= 0.70) {
          matchedProduct = bestCandidate;
        }
      }

      let priceIncreased = false;
      let oldCostPrice = null;

      if (matchedProduct) {
        matchStatus = "MATCHED";
        oldCostPrice = matchedProduct.costPrice;

        if (it.unitPrice > matchedProduct.costPrice) {
          priceIncreased = true;
          priceHikesDetected++;

          const diff = it.unitPrice - matchedProduct.costPrice;
          const pct = matchedProduct.costPrice > 0 ? (diff / matchedProduct.costPrice) * 100 : 0;

          // Catat ke histori perubahan harga
          await prisma.productPriceHistory.create({
            data: {
              productId: matchedProduct.id,
              oldCostPrice: matchedProduct.costPrice,
              newCostPrice: it.unitPrice,
              oldSellingPrice: matchedProduct.sellingPrice,
              newSellingPrice: matchedProduct.sellingPrice,
              difference: diff,
              percentage: Number(pct.toFixed(2)),
              sourceType: "RECEIPT_AI_SCAN",
              reason: `Nota ${supplierName || "Supplier"}: Modal naik +Rp ${diff.toLocaleString("id-ID")}`,
              receiptUrl,
              changedById: session.user.id,
              isConfirmed: false,
            },
          });
        }
      }

      scannedItemsToCreate.push({
        scanId: scan.id,
        rawName: it.rawName,
        barcodeOrCode: it.barcodeOrCode || null,
        qty: it.qty,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        matchStatus,
        matchedProductId: matchedProduct ? matchedProduct.id : null,
        priceIncreased,
        oldCostPrice,
      });
    }

    if (scannedItemsToCreate.length > 0) {
      await prisma.receiptScannedItem.createMany({
        data: scannedItemsToCreate,
      });
    }

    // Jika ada kenaikan harga, buat notifikasi alert untuk admin
    if (priceHikesDetected > 0) {
      try {
        const admins = await prisma.user.findMany({
          where: { storeId, role: { in: ["admin", "super_admin"] } },
          select: { id: true },
        });

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: `⚠️ ${priceHikesDetected} Kenaikan Modal Terdeteksi di Nota`,
              message: `Ekstraksi AI nota belanja ${supplierName || "supplier"} mendeteksi ${priceHikesDetected} barang mengalami kenaikan harga modal. Mohon tinjau harga jual kasir.`,
              type: "PRICE_ALERT",
              link: "/products",
            },
          });
        }
      } catch (err) {
        console.warn("Notification create failed:", err);
      }
    }

    // Ambil hasil lengkap dengan item
    const fullScan = await prisma.receiptAiScan.findUnique({
      where: { id: scan.id },
      include: {
        items: true,
      },
    });

    revalidatePath("/cashier/report");
    revalidatePath("/products");

    return {
      success: true,
      data: serialize({
        ...fullScan,
        priceHikesDetected,
      }),
    };
  } catch (error: any) {
    console.error("scanReceiptWithAi error:", error);
    return { success: false, error: error.message || "Gagal memproses nota belanja dengan AI." };
  }
}

export async function manualMapReceiptItem(
  scannedItemId: string,
  productId: string
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const item = await prisma.receiptScannedItem.findUnique({
      where: { id: scannedItemId },
      include: { scan: true },
    });
    if (!item) return { success: false, error: "Item nota tidak ditemukan" };

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return { success: false, error: "Produk database tidak ditemukan" };

    const isPriceHiked = item.unitPrice > product.costPrice;
    const diff = item.unitPrice - product.costPrice;
    const pct = product.costPrice > 0 ? (diff / product.costPrice) * 100 : 0;

    const updated = await prisma.receiptScannedItem.update({
      where: { id: scannedItemId },
      data: {
        matchedProductId: productId,
        matchStatus: "CONFIRMED",
        priceIncreased: isPriceHiked,
        oldCostPrice: product.costPrice,
      },
    });

    if (isPriceHiked) {
      await prisma.productPriceHistory.create({
        data: {
          productId: product.id,
          oldCostPrice: product.costPrice,
          newCostPrice: item.unitPrice,
          oldSellingPrice: product.sellingPrice,
          newSellingPrice: product.sellingPrice,
          difference: diff,
          percentage: Number(pct.toFixed(2)),
          sourceType: "RECEIPT_AI_SCAN",
          reason: `Mapping Manual Nota ${item.scan.supplierName || ""}: Modal naik +Rp ${diff.toLocaleString("id-ID")}`,
          receiptUrl: item.scan.receiptUrl,
          changedById: session.user.id,
          isConfirmed: false,
        },
      });
    }

    revalidatePath("/products");
    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("manualMapReceiptItem error:", error);
    return { success: false, error: "Gagal menghubungkan barang." };
  }
}

export async function markItemNotInKasir(scannedItemId: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const updated = await prisma.receiptScannedItem.update({
      where: { id: scannedItemId },
      data: {
        isMarkedNotInKasir: true,
        matchStatus: "CONFIRMED",
      },
    });

    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("markItemNotInKasir error:", error);
    return { success: false, error: "Gagal menandai barang." };
  }
}

export async function confirmItemAdjusted(scannedItemId: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const updated = await prisma.receiptScannedItem.update({
      where: { id: scannedItemId },
      data: {
        isAdjustedInKasir: true,
        adjustedById: session.user.id,
        adjustedAt: new Date(),
      },
    });

    return { success: true, data: serialize(updated) };
  } catch (error: any) {
    console.error("confirmItemAdjusted error:", error);
    return { success: false, error: "Gagal mengonfirmasi penyesuaian." };
  }
}

export async function quickAddProductFromScannedItem(
  scannedItemId: string,
  sellingPrice: number,
  stock = 0
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const storeId = session.user.storeId;
    const item = await prisma.receiptScannedItem.findUnique({
      where: { id: scannedItemId },
      include: { scan: true },
    });

    if (!item) return { success: false, error: "Item nota tidak ditemukan" };

    const newProduct = await prisma.product.create({
      data: {
        storeId,
        name: item.rawName,
        barcode: item.barcodeOrCode || null,
        costPrice: item.unitPrice,
        sellingPrice: Math.max(0, sellingPrice),
        stock: Math.max(0, stock),
        unit: "PCS",
        priceHistory: {
          create: {
            oldCostPrice: item.unitPrice,
            newCostPrice: item.unitPrice,
            oldSellingPrice: Math.max(0, sellingPrice),
            newSellingPrice: Math.max(0, sellingPrice),
            difference: 0,
            percentage: 0,
            sourceType: "RECEIPT_AI_SCAN",
            reason: `Dibuat dari Nota ${item.scan.supplierName || ""}`,
            receiptUrl: item.scan.receiptUrl,
            changedById: session.user.id,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: session.user.id,
          },
        },
      },
    });

    // Hubungkan item nota ke produk baru
    await prisma.receiptScannedItem.update({
      where: { id: scannedItemId },
      data: {
        matchedProductId: newProduct.id,
        matchStatus: "CONFIRMED",
        oldCostPrice: item.unitPrice,
      },
    });

    revalidatePath("/products");
    return { success: true, data: serialize(newProduct) };
  } catch (error: any) {
    console.error("quickAddProductFromScannedItem error:", error);
    return { success: false, error: error.message || "Gagal membuat produk baru dari item nota." };
  }
}

export async function getReceiptScanById(scanId: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.storeId) return { success: false, error: "Unauthorized" };

    const scan = await prisma.receiptAiScan.findFirst({
      where: { id: scanId, storeId: session.user.storeId },
      include: {
        items: true,
      },
    });

    if (!scan) return { success: false, error: "Data scan tidak ditemukan" };

    return { success: true, data: serialize(scan) };
  } catch (error: any) {
    console.error("getReceiptScanById error:", error);
    return { success: false, error: "Gagal memuat detail scan nota" };
  }
}
