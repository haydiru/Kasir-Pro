import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";
import { revalidatePath } from "next/cache";
import { getCurrentUser, isAdminRole } from "@/lib/auth-guard";
import { logActivity, pickChanges } from "@/lib/activity-log";

const PRODUCT_FIELDS = ["name", "itemCode", "barcode", "stock", "costPrice", "sellingPrice", "unit", "category"];
const LOG_CHUNK_SIZE = 200;

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMPORT_ROWS = 10000;

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Mass price/stock overwrite is restricted to admins
    if (!isAdminRole(currentUser.role)) {
      return NextResponse.json({ error: "Hanya Admin yang dapat mengimport data barang" }, { status: 403 });
    }

    const storeId = currentUser.storeId;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File Excel tidak ditemukan" }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json({ error: "Ukuran file Excel maksimal 5 MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(bytes, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Baca baris mentah sebagai array of arrays
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

    if (rows && rows.length > MAX_IMPORT_ROWS + 1) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_IMPORT_ROWS} baris per file import` },
        { status: 400 }
      );
    }

    if (!rows || rows.length <= 1) {
      return NextResponse.json(
        { error: "File Excel kosong atau hanya berisi header" },
        { status: 400 }
      );
    }

    // Normalisasi Header kolom baris pertama
    const headers = (rows[0] as any[]).map((h) =>
      h !== undefined && h !== null ? String(h).toUpperCase().trim().replace(/\s+/g, "_") : ""
    );

    const getColIndex = (names: string[], fallback: number) => {
      for (const n of names) {
        const idx = headers.indexOf(n);
        if (idx !== -1) return idx;
      }
      return fallback;
    };

    const colIdx = {
      itemCode: getColIndex(["ID_BARANG", "KODE_BARANG", "KODE", "SKU"], 0),
      barcode: getColIndex(["KODE_BARCODE", "BARCODE", "NO_BARCODE"], 1),
      name: getColIndex(["NAMA_BARANG", "NAMA", "PRODUK", "DESKRIPSI"], 2),
      stock: getColIndex(["JUMLAH_STOK", "STOK", "QTY", "JUMLAH"], 3),
      costPrice: getColIndex(["HARGA_MODAL", "MODAL", "HARGA_BELI", "BELI"], 4),
      sellingPrice: getColIndex(["HARGA_JUAL", "JUAL", "HARGA"], 5),
      unit: getColIndex(["SATUAN", "UNIT"], 6),
      category: getColIndex(["KATEGORI", "CATEGORY"], 7),
    };

    let inserted = 0;
    let updated = 0;
    let priceHikes = 0;
    let skipped = 0;
    const priceHikeDetails: Array<{ name: string; oldCost: number; newCost: number; selling: number }> = [];
    // Jejak audit per baris yang benar-benar berubah
    const auditChanges: Array<Record<string, unknown>> = [];

    // Proses setiap baris data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawName = row[colIdx.name];
      if (!rawName || String(rawName).trim() === "") {
        skipped++;
        continue;
      }

      const name = String(rawName).trim();
      const itemCode = row[colIdx.itemCode] ? String(row[colIdx.itemCode]).trim() : null;
      const barcode = row[colIdx.barcode] ? String(row[colIdx.barcode]).trim() : null;
      const stock = Math.max(0, parseInt(String(row[colIdx.stock] || "0").replace(/[^0-9-]/g, "")) || 0);
      const costPrice = Math.max(0, parseFloat(String(row[colIdx.costPrice] || "0").replace(/[^0-9.]/g, "")) || 0);
      const sellingPrice = Math.max(0, parseFloat(String(row[colIdx.sellingPrice] || "0").replace(/[^0-9.]/g, "")) || 0);
      const unit = row[colIdx.unit] ? String(row[colIdx.unit]).trim() : "PCS";
      const category = row[colIdx.category] ? String(row[colIdx.category]).trim() : null;

      // Cari apakah barang sudah ada di toko ini berdasarkan Barcode, ID Barang, atau Nama persis
      let existing = null;
      if (barcode) {
        existing = await prisma.product.findFirst({
          where: { storeId, barcode, isActive: true },
        });
      }
      if (!existing && itemCode) {
        existing = await prisma.product.findFirst({
          where: { storeId, itemCode, isActive: true },
        });
      }
      if (!existing) {
        existing = await prisma.product.findFirst({
          where: { storeId, name: { equals: name, mode: "insensitive" }, isActive: true },
        });
      }

      if (existing) {
        // Cek kenaikan harga modal
        const isCostHiked = costPrice > existing.costPrice;
        const newSellingPrice = sellingPrice > 0 ? sellingPrice : existing.sellingPrice;
        const isPriceChanged = costPrice !== existing.costPrice || newSellingPrice !== existing.sellingPrice;
        const diff = costPrice - existing.costPrice;
        const pct = existing.costPrice > 0 ? (diff / existing.costPrice) * 100 : 0;

        const updatedProduct = await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            costPrice,
            sellingPrice: sellingPrice > 0 ? sellingPrice : existing.sellingPrice,
            stock,
            barcode: barcode || existing.barcode,
            itemCode: itemCode || existing.itemCode,
            unit,
            category: category || existing.category,
          },
        });
        const rowChanges = pickChanges(existing, updatedProduct, PRODUCT_FIELDS);
        if (rowChanges.changed.length > 0) {
          auditChanges.push({ op: "UPDATE", id: existing.id, row: i + 1, before: rowChanges.before, after: rowChanges.after });
        }

        if (isCostHiked) {
          priceHikes++;
          priceHikeDetails.push({
            name,
            oldCost: existing.costPrice,
            newCost: costPrice,
            selling: sellingPrice > 0 ? sellingPrice : existing.sellingPrice,
          });

          await prisma.productPriceHistory.create({
            data: {
              productId: existing.id,
              oldCostPrice: existing.costPrice,
              newCostPrice: costPrice,
              oldSellingPrice: existing.sellingPrice,
              newSellingPrice: sellingPrice > 0 ? sellingPrice : existing.sellingPrice,
              difference: diff,
              percentage: Number(pct.toFixed(2)),
              sourceType: "EXCEL_IMPORT",
              reason: `Import Excel: Modal naik +Rp ${diff.toLocaleString("id-ID")}`,
              changedById: currentUser.id,
              isConfirmed: false,
            },
          });
        } else if (isPriceChanged) {
          // Record every other price change too (cost decrease / selling price change)
          await prisma.productPriceHistory.create({
            data: {
              productId: existing.id,
              oldCostPrice: existing.costPrice,
              newCostPrice: costPrice,
              oldSellingPrice: existing.sellingPrice,
              newSellingPrice,
              difference: diff,
              percentage: Number(pct.toFixed(2)),
              sourceType: "EXCEL_IMPORT",
              reason: "Import Excel: Perubahan Harga",
              changedById: currentUser.id,
              isConfirmed: true,
              confirmedAt: new Date(),
              confirmedById: currentUser.id,
            },
          });
        }

        updated++;
      } else {
        // Buat produk baru
        const createdProduct = await prisma.product.create({
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
                sourceType: "EXCEL_IMPORT",
                reason: "Import Excel Produk Baru",
                changedById: currentUser.id,
                isConfirmed: true,
                confirmedAt: new Date(),
                confirmedById: currentUser.id,
              },
            },
          },
        });

        auditChanges.push({
          op: "CREATE",
          id: createdProduct.id,
          row: i + 1,
          after: { name, itemCode, barcode, stock, costPrice, sellingPrice, unit, category },
        });
        inserted++;
      }
    }

    // Catat import ke log aktivitas (dipecah per 200 perubahan agar detail tidak terpotong)
    const fileName = file.name.slice(0, 200);
    const totalChunks = Math.max(1, Math.ceil(auditChanges.length / LOG_CHUNK_SIZE));
    for (let c = 0; c < totalChunks; c++) {
      const chunk = auditChanges.slice(c * LOG_CHUNK_SIZE, (c + 1) * LOG_CHUNK_SIZE);
      await logActivity(prisma, {
        actor: currentUser,
        action: "IMPORT",
        entityType: "Product",
        summary: `Import Excel "${fileName}": ${inserted} baru, ${updated} diperbarui, ${priceHikes} harga modal naik, ${skipped} dilewati` +
          (totalChunks > 1 ? ` (bagian ${c + 1}/${totalChunks})` : ""),
        after: { changes: chunk },
      });
    }

    // Jika ada kenaikan harga modal terdeteksi, buat notifikasi lonceng sistem untuk Admin
    if (priceHikes > 0) {
      try {
        const admins = await prisma.user.findMany({
          where: {
            storeId,
            role: { in: ["admin", "super_admin"] },
          },
          select: { id: true },
        });

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: `⚠️ ${priceHikes} Barang Mengalami Kenaikan Harga Modal`,
              message: `Hasil import file Excel mendeteksi ${priceHikes} barang naik harga modalnya. Mohon cek dan sesuaikan harga jual di aplikasi kasir.`,
              type: "PRICE_ALERT",
              link: "/products",
            },
          });
        }
      } catch (notifErr) {
        console.warn("Gagal membuat notifikasi lonceng import Excel:", notifErr);
      }
    }

    revalidatePath("/products");

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      priceHikes,
      skipped,
      priceHikeDetails,
      message: `Berhasil mengimport data: ${inserted} baru, ${updated} diperbarui (${priceHikes} mengalami kenaikan modal).`,
    });
  } catch (error: any) {
    console.error("Import Products Excel error:", error);
    return NextResponse.json(
      { error: "Gagal memproses file Excel data barang" },
      { status: 500 }
    );
  }
}
