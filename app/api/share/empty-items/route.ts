import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/share/empty-items?storeId=UUID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json({ error: "Store ID is required" }, { status: 400 });
    }

    const items = await prisma.emptyItem.findMany({
      where: { storeId },
      include: {
        createdBy: { select: { name: true } },
        processor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/share/empty-items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/share/empty-items
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, status, workerName } = body;

    if (!itemId || !status) {
      return NextResponse.json({ error: "Item ID and status are required" }, { status: 400 });
    }

    const item = await prisma.emptyItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const validStatuses = ["BUTUH", "PROSES", "SELESAI"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Ekstrak catatan asli tanpa prefix "[Diproses oleh: ...]"
    const currentNotes = item.notes || "";
    const cleanNotes = currentNotes.replace(/^\[Diproses oleh: (.*?)\]\s*/, "");

    let newNotes = item.notes;
    let processorId = item.processorId;

    if (status === "PROSES") {
      if (workerName && workerName.trim()) {
        newNotes = `[Diproses oleh: ${workerName.trim()}] ${cleanNotes}`.trim();
      } else {
        newNotes = `[Diproses oleh: Eksternal] ${cleanNotes}`.trim();
      }
      processorId = null; // Bukan user internal toko
    } else if (status === "BUTUH") {
      newNotes = cleanNotes === "" ? null : cleanNotes;
      processorId = null;
    } else if (status === "SELESAI") {
      // Jika status diselesaikan oleh orang umum, pastikan catatan proses tetap ada jika belum selesai
      if (!item.notes?.startsWith("[Diproses oleh: ") && workerName && workerName.trim()) {
        newNotes = `[Diproses oleh: ${workerName.trim()}] ${cleanNotes}`.trim();
      }
    }

    const updatedItem = await prisma.emptyItem.update({
      where: { id: itemId },
      data: {
        status,
        notes: newNotes,
        processorId,
      },
      include: {
        createdBy: { select: { name: true } },
        processor: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updatedItem });
  } catch (error) {
    console.error("PATCH /api/share/empty-items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
