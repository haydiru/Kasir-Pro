import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdminRole } from "@/lib/auth-guard";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_MAX_AGE,
  createOAuthNonce,
  parseGoogleAuthType,
} from "@/lib/google-oauth-state";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connecting store-wide Google accounts is an admin-only operation
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
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
    const type = parseGoogleAuthType(req.nextUrl.searchParams.get("type") || "CALENDAR");

    if (!type) {
      return NextResponse.json(
        { success: false, error: "Tipe integrasi Google tidak valid" },
        { status: 400 }
      );
    }

    // Tentukan scope berdasarkan tipe integrasi
    const scope = type === "GMAIL"
      ? "https://www.googleapis.com/auth/gmail.readonly"
      : "https://www.googleapis.com/auth/calendar.events";

    // `state` carries a random nonce (also stored in an httpOnly cookie) plus the type.
    // The store is NOT taken from `state`; the callback uses the logged-in admin's store.
    const nonce = createOAuthNonce();

    // Bangun URL OAuth Consent Google
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(`${nonce}:${type}`)}`;

    const response = NextResponse.redirect(googleAuthUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: GOOGLE_OAUTH_STATE_MAX_AGE,
    });
    return response;
  } catch (error: any) {
    console.error("Error initiating Google OAuth:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
