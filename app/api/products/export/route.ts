import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });

    const products = await prisma.product.findMany({
      where: { storeId, isActive: true },
      orderBy: { name: "asc" },
    });

    // Buat data rows untuk worksheet
    const dataRows = products.map((p) => {
      const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0;
      return {
        ID_BARANG: p.itemCode || "",
        KODE_BARCODE: p.barcode || "",
        NAMA_BARANG: p.name,
        JUMLAH_STOK: p.stock,
        HARGA_MODAL: p.costPrice,
        HARGA_JUAL: p.sellingPrice,
        SATUAN: p.unit || "PCS",
        KATEGORI: p.category || "",
        "MARGIN_%": Number(margin.toFixed(1)),
      };
    });

    // Jika belum ada barang, sediakan 1 baris contoh template
    if (dataRows.length === 0) {
      dataRows.push({
        ID_BARANG: "BRG-001",
        KODE_BARCODE: "8999999123456",
        NAMA_BARANG: "Contoh Produk A",
        JUMLAH_STOK: 50,
        HARGA_MODAL: 5000,
        HARGA_JUAL: 6500,
        SATUAN: "PCS",
        KATEGORI: "Umum",
        "MARGIN_%": 23.1,
      });
    }

    const worksheet = xlsx.utils.json_to_sheet(dataRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Data_Barang");

    // Atur lebar kolom agar rapi
    worksheet["!cols"] = [
      { wch: 15 }, // ID_BARANG
      { wch: 18 }, // KODE_BARCODE
      { wch: 35 }, // NAMA_BARANG
      { wch: 12 }, // JUMLAH_STOK
      { wch: 15 }, // HARGA_MODAL
      { wch: 15 }, // HARGA_JUAL
      { wch: 10 }, // SATUAN
      { wch: 15 }, // KATEGORI
      { wch: 12 }, // MARGIN_%
    ];

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    const storeNameSafe = (store?.name || "Toko").replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `Data_Barang_${storeNameSafe}_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Export Products Excel error:", error);
    return NextResponse.json({ error: "Gagal mendownload data barang" }, { status: 500 });
  }
}
