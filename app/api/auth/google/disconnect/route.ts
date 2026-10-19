import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdminRole } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-log";
import { parseGoogleAuthType } from "@/lib/google-oauth-state";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Disconnecting store-wide Google accounts is an admin-only operation
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const storeId = user.storeId;

    const body = await req.json().catch(() => ({}));
    const type = parseGoogleAuthType(body.type || req.nextUrl.searchParams.get("type") || "CALENDAR");
    if (!type) {
      return NextResponse.json(
        { success: false, error: "Tipe integrasi Google tidak valid" },
        { status: 400 }
      );
    }

    // Hapus data Google OAuth dari database berdasarkan (storeId, type)
    await prisma.$transaction(async (tx) => {
      const result = await tx.storeGoogleAuth.deleteMany({
        where: { storeId, type },
      });
      if (result.count > 0) {
        await logActivity(tx, {
          actor: user,
          action: "SETTING_CHANGE",
          entityType: "StoreGoogleAuth",
          entityId: storeId,
          summary: `Memutus koneksi akun Google ${type === "GMAIL" ? "Gmail (Flip)" : "Calendar"}`,
          before: { type },
        });
      }
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
