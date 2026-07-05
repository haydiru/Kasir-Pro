import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAuthorized = ["admin", "super_admin"].includes(session.user.role);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const storeId = session.user.storeId;
    const body = await req.json();

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.storeId !== storeId) {
      return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        nama: body.nama ? body.nama.trim() : undefined,
        alamat: body.alamat !== undefined ? (body.alamat ? body.alamat.trim() : null) : undefined,
        kota: body.kota !== undefined ? (body.kota ? body.kota.trim() : null) : undefined,
        provinsi: body.provinsi !== undefined ? (body.provinsi ? body.provinsi.trim() : null) : undefined,
        negara: body.negara !== undefined ? (body.negara ? body.negara.trim() : null) : undefined,
        kodePos: body.kodePos !== undefined ? (body.kodePos ? body.kodePos.trim() : null) : undefined,
        telepon: body.telepon !== undefined ? (body.telepon ? body.telepon.trim() : null) : undefined,
        fax: body.fax !== undefined ? (body.fax ? body.fax.trim() : null) : undefined,
        bank: body.bank !== undefined ? (body.bank ? body.bank.trim() : null) : undefined,
        acc: body.acc !== undefined ? (body.acc ? body.acc.trim() : null) : undefined,
        atasNama: body.atasNama !== undefined ? (body.atasNama ? body.atasNama.trim() : null) : undefined,
        kontak: body.kontak !== undefined ? (body.kontak ? body.kontak.trim() : null) : undefined,
        email: body.email !== undefined ? (body.email ? body.email.trim() : null) : undefined,
        keterangan: body.keterangan !== undefined ? (body.keterangan ? body.keterangan.trim() : null) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/suppliers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAuthorized = ["admin", "super_admin"].includes(session.user.role);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const storeId = session.user.storeId;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.storeId !== storeId) {
      return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
    }

    // Hapus data supplier
    await prisma.supplier.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/suppliers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
