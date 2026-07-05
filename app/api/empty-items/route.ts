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
    const { itemName, notes } = body;

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
