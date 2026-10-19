import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdminRole } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-log";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  nonceMatches,
  parseGoogleAuthType,
} from "@/lib/google-oauth-state";

function redirectWithClearedState(url: string) {
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 0,
  });
  return response;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const stateParam = searchParams.get("state") || "";
    const [stateNonce, rawType = "CALENDAR"] = stateParam.split(":");
    const type = parseGoogleAuthType(rawType);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectSettingsUrl = `${appUrl}/admin/store-settings`;

    if (errorParam) {
      console.error("Google OAuth error parameter:", errorParam);
      return redirectWithClearedState(`${redirectSettingsUrl}?error=google_denied`);
    }

    // CSRF protection: `state` must match the nonce issued to this browser by /initiate
    const expectedNonce = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    if (!nonceMatches(expectedNonce, stateNonce) || !type) {
      console.error("Google OAuth state mismatch or invalid type");
      return redirectWithClearedState(`${redirectSettingsUrl}?error=invalid_oauth_state`);
    }

    // The account is linked to the logged-in admin's own store (never a store from the URL)
    const user = await getCurrentUser();
    if (!user || !isAdminRole(user.role)) {
      return redirectWithClearedState(`${redirectSettingsUrl}?error=unauthorized`);
    }
    const storeId = user.storeId;

    if (!code) {
      return redirectWithClearedState(`${redirectSettingsUrl}?error=missing_auth_params`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      console.error("Google credentials are not configured properly in .env");
      return redirectWithClearedState(`${redirectSettingsUrl}?error=server_configuration_error`);
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Tukar Authorization Code dengan Token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Failed to exchange auth code for tokens:", errorText);
      return redirectWithClearedState(`${redirectSettingsUrl}?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // Hitung tanggal kedaluwarsa token (sekarang + expires_in detik)
    const expiryDate = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Upsert token Google OAuth toko ke database berdasarkan (storeId, type)
    await prisma.$transaction(async (tx) => {
     await tx.storeGoogleAuth.upsert({
      where: {
        storeId_type: { storeId, type },
      },
      update: {
        accessToken: tokens.access_token,
        // Refresh token hanya dikirim Google pada authorization pertama,
        // simpan token lama jika Google tidak mengirimkannya kembali kali ini.
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiryDate,
      },
      create: {
        storeId,
        type,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiryDate,
      },
     });
     // Token Google tidak pernah dicatat
     await logActivity(tx, {
       actor: user,
       action: "SETTING_CHANGE",
       entityType: "StoreGoogleAuth",
       entityId: storeId,
       summary: `Menghubungkan akun Google ${type === "GMAIL" ? "Gmail (Flip)" : "Calendar"}`,
       after: { type },
     });
    });
    const successFlag = type === "GMAIL" ? "gmail_connected" : "google_connected";
    return redirectWithClearedState(`${redirectSettingsUrl}?success=${successFlag}`);
  } catch (error: any) {
    console.error("Error in Google OAuth callback handler:", error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    return redirectWithClearedState(`${appUrl}/admin/store-settings?error=callback_internal_error`);
  }
}
