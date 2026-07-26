import { NextRequest, NextResponse } from "next/server";
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

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      return NextResponse.json(
        { success: false, error: "Google Client ID belum dikonfigurasi di server" },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const storeId = session.user.storeId;
    const type = req.nextUrl.searchParams.get("type") || "CALENDAR";

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "User tidak diasosiasikan dengan toko mana pun" },
        { status: 400 }
      );
    }

    // Tentukan scope berdasarkan tipe integrasi
    const scope = type === "GMAIL"
      ? "https://www.googleapis.com/auth/gmail.readonly"
      : "https://www.googleapis.com/auth/calendar.events";

    // Bangun URL OAuth Consent Google (state menyimpan storeId:type)
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(`${storeId}:${type}`)}`;

    return NextResponse.redirect(googleAuthUrl);
  } catch (error: any) {
    console.error("Error initiating Google OAuth:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
