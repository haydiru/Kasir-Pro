import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "User does not belong to any store" },
        { status: 400 }
      );
    }

    const items = await prisma.emptyItem.findMany({
      where: { storeId },
      include: {
        createdBy: { select: { name: true } },
        processor: { select: { name: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error("GET /api/empty-items error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "User does not belong to any store" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { itemName, notes, items } = body;

    // Check if this is a batch request (items array is provided)
    if (Array.isArray(items)) {
      const validItems = items.filter(
        (item: any) =>
          item.itemName &&
          typeof item.itemName === "string" &&
          item.itemName.trim() !== ""
      );

      if (validItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Daftar barang tidak boleh kosong" },
          { status: 400 }
        );
      }

      await prisma.emptyItem.createMany({
        data: validItems.map((item: any) => ({
          storeId,
          itemName: item.itemName.trim(),
          notes: item.notes ? item.notes.trim() : null,
          createdById: session.user.id,
          status: "BUTUH",
        })),
      });

      return NextResponse.json(
        {
          success: true,
          message: `${validItems.length} barang berhasil dilaporkan`,
        },
        { status: 201 }
      );
    }

    // Single item fallback
    if (!itemName || typeof itemName !== "string" || itemName.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Nama barang harus diisi" },
        { status: 400 }
      );
    }

    const newItem = await prisma.emptyItem.create({
      data: {
        storeId,
        itemName: itemName.trim(),
        notes: notes ? notes.trim() : null,
        createdById: session.user.id,
        status: "BUTUH",
      },
      include: {
        createdBy: { select: { name: true } },
        processor: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/empty-items error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "User does not belong to any store" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { ids, status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "ID barang tidak boleh kosong" },
        { status: 400 }
      );
    }

    const validStatuses = ["BUTUH", "PROSES", "SELESAI"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status tidak valid" },
        { status: 400 }
      );
    }

    const updateData: any = { status };

    if (status === "PROSES") {
      updateData.processorId = session.user.id;
    } else if (status === "BUTUH") {
      updateData.processorId = null;
    } else if (status === "SELESAI") {
      updateData.processorId = session.user.id;
    }

    await prisma.emptyItem.updateMany({
      where: {
        id: { in: ids },
        storeId,
      },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `${ids.length} status barang berhasil diperbarui`,
    });
  } catch (error: any) {
    console.error("PATCH /api/empty-items batch error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "User does not belong to any store" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "ID barang tidak boleh kosong" },
        { status: 400 }
      );
    }

    await prisma.emptyItem.deleteMany({
      where: {
        id: { in: ids },
        storeId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${ids.length} barang berhasil dihapus`,
    });
  } catch (error: any) {
    console.error("DELETE /api/empty-items batch error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
