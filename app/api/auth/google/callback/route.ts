import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const storeId = searchParams.get("state"); // storeId dikirim via state parameter

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectSettingsUrl = `${appUrl}/admin/store-settings`;

    if (errorParam) {
      console.error("Google OAuth error parameter:", errorParam);
      return NextResponse.redirect(`${redirectSettingsUrl}?error=google_denied`);
    }

    if (!code || !storeId) {
      return NextResponse.redirect(`${redirectSettingsUrl}?error=missing_auth_params`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      console.error("Google credentials are not configured properly in .env");
      return NextResponse.redirect(`${redirectSettingsUrl}?error=server_configuration_error`);
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
      return NextResponse.redirect(`${redirectSettingsUrl}?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // Hitung tanggal kedaluwarsa token (sekarang + expires_in detik)
    const expiryDate = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Cari tahu apakah store ini ada
    const storeExists = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!storeExists) {
      console.error("Store not found for ID:", storeId);
      return NextResponse.redirect(`${redirectSettingsUrl}?error=store_not_found`);
    }

    // Upsert token Google OAuth toko ke database
    await prisma.storeGoogleAuth.upsert({
      where: { storeId },
      update: {
        accessToken: tokens.access_token,
        // Refresh token hanya dikirim Google pada authorization pertama,
        // simpan token lama jika Google tidak mengirimkannya kembali kali ini.
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiryDate,
      },
      create: {
        storeId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiryDate,
      },
    });

    return NextResponse.redirect(`${redirectSettingsUrl}?success=google_connected`);
  } catch (error: any) {
    console.error("Error in Google OAuth callback handler:", error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    return NextResponse.redirect(`${appUrl}/admin/store-settings?error=callback_internal_error`);
  }
}
