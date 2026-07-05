import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/suppliers?q=search_query
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";

    const suppliers = await prisma.supplier.findMany({
      where: {
        storeId,
        OR: [
          { nama: { contains: q, mode: "insensitive" } },
          { kode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { nama: "asc" },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("GET /api/suppliers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/suppliers
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin, Super Admin, dan Cashier diijinkan untuk menambahkan supplier
    const isAuthorized = ["admin", "super_admin", "cashier"].includes(session.user.role);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = session.user.storeId;
    const body = await req.json();
    const {
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
    } = body;

    if (!kode || !nama) {
      return NextResponse.json(
        { error: "KODE dan NAMA supplier wajib diisi" },
        { status: 400 }
      );
    }

    // Cek apakah kode supplier sudah digunakan di toko ini
    const existingSupplier = await prisma.supplier.findUnique({
      where: {
        storeId_kode: {
          storeId,
          kode: kode.trim(),
        },
      },
    });

    if (existingSupplier) {
      return NextResponse.json(
        { error: `Supplier dengan kode "${kode}" sudah terdaftar` },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        storeId,
        kode: kode.trim(),
        nama: nama.trim(),
        alamat: alamat?.trim() || null,
        kota: kota?.trim() || null,
        provinsi: provinsi?.trim() || null,
        negara: negara?.trim() || "Indonesia",
        kodePos: kodePos?.trim() || null,
        telepon: telepon?.trim() || null,
        fax: fax?.trim() || null,
        bank: bank?.trim() || null,
        acc: acc?.trim() || null,
        atasNama: atasNama?.trim() || null,
        kontak: kontak?.trim() || null,
        email: email?.trim() || null,
        keterangan: keterangan?.trim() || null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("POST /api/suppliers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
