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

    // Hapus data Google OAuth dari database
    await prisma.storeGoogleAuth.deleteMany({
      where: { storeId },
    });

    return NextResponse.json({ success: true, message: "Koneksi Google Calendar berhasil diputuskan" });
  } catch (error: any) {
    console.error("POST /api/auth/google/disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
