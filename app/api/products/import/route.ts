import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File Excel tidak ditemukan" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(bytes, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Baca baris mentah sebagai array of arrays
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

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
        const diff = costPrice - existing.costPrice;
        const pct = existing.costPrice > 0 ? (diff / existing.costPrice) * 100 : 0;

        await prisma.product.update({
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
              changedById: session.user.id,
              isConfirmed: false,
            },
          });
        }

        updated++;
      } else {
        // Buat produk baru
        await prisma.product.create({
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
                changedById: session.user.id,
                isConfirmed: true,
                confirmedAt: new Date(),
                confirmedById: session.user.id,
              },
            },
          },
        });

        inserted++;
      }
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
      { error: error.message || "Gagal memproses file Excel data barang" },
      { status: 500 }
    );
  }
}
