import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

    const body = await req.json().catch(() => ({}));
    const type = body.type || req.nextUrl.searchParams.get("type") || "CALENDAR";

    // Hapus data Google OAuth dari database berdasarkan (storeId, type)
    await prisma.storeGoogleAuth.deleteMany({
      where: { storeId, type },
    });

    return NextResponse.json({ success: true, message: `Koneksi Google ${type} berhasil diputuskan` });
  } catch (error: any) {
    console.error("POST /api/auth/google/disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
