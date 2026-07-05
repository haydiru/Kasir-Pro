import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const { status, itemName, notes } = body as {
      status?: string;
      itemName?: string;
      notes?: string;
    };

    // Find the item first to check ownership
    const item = await prisma.emptyItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    if (item.storeId !== storeId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Item belongs to another store" },
        { status: 403 }
      );
    }

    const updateData: any = {};

    if (itemName !== undefined) {
      if (itemName.trim() === "") {
        return NextResponse.json(
          { success: false, error: "Nama barang tidak boleh kosong" },
          { status: 400 }
        );
      }
      updateData.itemName = itemName.trim();
    }

    if (notes !== undefined) {
      updateData.notes = notes ? notes.trim() : null;
    }

    if (status !== undefined) {
      const validStatuses = ["BUTUH", "PROSES", "SELESAI"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: "Status tidak valid" },
          { status: 400 }
        );
      }

      updateData.status = status;

      if (status === "PROSES") {
        updateData.processorId = session.user.id;
      } else if (status === "BUTUH") {
        updateData.processorId = null;
      } else if (status === "SELESAI") {
        // If it was already PROSES, keep the processor. Otherwise, set the current user as processor.
        if (!item.processorId) {
          updateData.processorId = session.user.id;
        }
      }
    }

    const updatedItem = await prisma.emptyItem.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { name: true } },
        processor: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updatedItem });
  } catch (error: any) {
    console.error("PATCH /api/empty-items/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Find the item first to check ownership
    const item = await prisma.emptyItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    if (item.storeId !== storeId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Item belongs to another store" },
        { status: 403 }
      );
    }

    await prisma.emptyItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Barang berhasil dihapus" });
  } catch (error: any) {
    console.error("DELETE /api/empty-items/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
