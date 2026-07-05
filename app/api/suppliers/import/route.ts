import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hanya Admin dan Super Admin yang boleh mengimport data supplier
    const isAuthorized = ["admin", "super_admin"].includes(session.user.role);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = session.user.storeId;
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = xlsx.read(bytes, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Baca baris mentah sebagai array of arrays
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

    if (rows.length <= 1) {
      return NextResponse.json(
        { error: "File Excel kosong atau hanya berisi header" },
        { status: 400 }
      );
    }

    // Baca header baris pertama
    const headers = (rows[0] as any[]).map((h) =>
      h !== undefined && h !== null ? String(h).toUpperCase().trim() : ""
    );

    // Map indeks kolom berdasarkan nama header atau fallback ke kolom A-O (0-14)
    const colIdx = {
      kode: headers.indexOf("KODE") !== -1 ? headers.indexOf("KODE") : 0,
      nama: headers.indexOf("NAMA") !== -1 ? headers.indexOf("NAMA") : 1,
      alamat: headers.indexOf("ALAMAT") !== -1 ? headers.indexOf("ALAMAT") : 2,
      kota: headers.indexOf("KOTA") !== -1 ? headers.indexOf("KOTA") : 3,
      provinsi: headers.indexOf("PROVINSI") !== -1 ? headers.indexOf("PROVINSI") : 4,
      negara: headers.indexOf("NEGARA") !== -1 ? headers.indexOf("NEGARA") : 5,
      kodePos: headers.indexOf("KODEPOS") !== -1 ? headers.indexOf("KODEPOS") : 6,
      telepon: headers.indexOf("TELEPON") !== -1 ? headers.indexOf("TELEPON") : 7,
      fax: headers.indexOf("FAX") !== -1 ? headers.indexOf("FAX") : 8,
      bank: headers.indexOf("BANK") !== -1 ? headers.indexOf("BANK") : 9,
      acc: headers.indexOf("ACC") !== -1 ? headers.indexOf("ACC") : 10,
      atasNama: headers.indexOf("ATASNAMA") !== -1 ? headers.indexOf("ATASNAMA") : 11,
      kontak: headers.indexOf("KONTAK") !== -1 ? headers.indexOf("KONTAK") : 12,
      email: headers.indexOf("EMAIL") !== -1 ? headers.indexOf("EMAIL") : 13,
      keterangan: headers.indexOf("KETERANGAN") !== -1 ? headers.indexOf("KETERANGAN") : 14,
    };

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Iterasi dari baris ke-2 (indeks 1)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const kodeVal = row[colIdx.kode];
      const namaVal = row[colIdx.nama];

      // KODE dan NAMA wajib diisi
      if (kodeVal === undefined || kodeVal === null || String(kodeVal).trim() === "" ||
          namaVal === undefined || namaVal === null || String(namaVal).trim() === "") {
        skipped++;
        continue;
      }

      const kode = String(kodeVal).trim();
      const nama = String(namaVal).trim();

      const getVal = (idx: number) => {
        const val = row[idx];
        return val !== undefined && val !== null ? String(val).trim() : null;
      };

      const alamat = getVal(colIdx.alamat);
      const kota = getVal(colIdx.kota);
      const provinsi = getVal(colIdx.provinsi);
      const negara = getVal(colIdx.negara) || "Indonesia";
      const kodePos = getVal(colIdx.kodePos);
      const telepon = getVal(colIdx.telepon);
      const fax = getVal(colIdx.fax);
      const bank = getVal(colIdx.bank);
      const acc = getVal(colIdx.acc);
      const atasNama = getVal(colIdx.atasNama);
      const kontak = getVal(colIdx.kontak);
      const email = getVal(colIdx.email);
      const keterangan = getVal(colIdx.keterangan);

      // Gunakan upsert dengan kombinasi unik (storeId, kode)
      const existing = await prisma.supplier.findUnique({
        where: {
          storeId_kode: {
            storeId,
            kode,
          },
        },
      });

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            nama,
            alamat,
            kota,
            provinsi,
            negara,
            kodePos,
            telepon,
            fax,
            bank,
            acc,
            atasNama,
            kontak,
            email,
            keterangan,
          },
        });
        updated++;
      } else {
        await prisma.supplier.create({
          data: {
            storeId,
            kode,
            nama,
            alamat,
            kota,
            provinsi,
            negara,
            kodePos,
            telepon,
            fax,
            bank,
            acc,
            atasNama,
            kontak,
            email,
            keterangan,
          },
        });
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Data supplier berhasil diimport",
      summary: { inserted, updated, skipped },
    });
  } catch (error: any) {
    console.error("POST /api/suppliers/import error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
