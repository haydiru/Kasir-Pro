"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFlipEmail } from "@/lib/flip-parser";
import { revalidatePath } from "next/cache";

// Helper untuk mendapatkan Google Access Token khusus Gmail
async function getGmailAccessToken(storeId: string): Promise<string | null> {
  const googleAuth = await prisma.storeGoogleAuth.findUnique({
    where: {
      storeId_type: { storeId, type: "GMAIL" },
    },
  });

  if (!googleAuth) return null;

  // Cek apakah token kedaluwarsa (tambahkan buffer 5 menit)
  const isExpired = new Date(googleAuth.expiryDate).getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return googleAuth.accessToken;
  }

  // Refresh token Google OAuth
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      console.warn("Google credentials not configured for Gmail refresh flow");
      return null;
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: googleAuth.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("Gagal melakukan refresh token Gmail:", await res.text());
      return null;
    }

    const data = await res.json();
    const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await prisma.storeGoogleAuth.update({
      where: { storeId_type: { storeId, type: "GMAIL" } },
      data: {
        accessToken: data.access_token,
        expiryDate,
      },
    });

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing Gmail Access Token:", error);
    return null;
  }
}

/**
 * Decode Base64URL string encoded by Gmail API into UTF-8 text/HTML
 */
function decodeBase64Url(base64UrlStr: string): string {
  try {
    let base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch (e) {
    console.error("Error decoding base64url payload:", e);
    return "";
  }
}

/**
 * Recursively extract body HTML or plain text from Gmail message payload parts
 */
function extractBodyFromPayload(payload: any): string {
  if (!payload) return "";

  // Direct body on payload
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Check parts
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer HTML part
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return decodeBase64Url(htmlPart.body.data);
    }

    // Fallback to plain text part
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart && textPart.body && textPart.body.data) {
      return decodeBase64Url(textPart.body.data);
    }

    // Recursive search in sub-parts
    for (const part of payload.parts) {
      const subBody = extractBodyFromPayload(part);
      if (subBody) return subBody;
    }
  }

  return "";
}

/**
 * Server Action: Tarik email Flip langsung dari Gmail API
 */
export async function syncFlipEmailsFromGmail() {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return { error: "Unauthorized / Toko tidak ditemukan" };
    }

    const storeId = session.user.storeId;
    const token = await getGmailAccessToken(storeId);

    if (!token) {
      return { error: "Akun Gmail Flip belum terhubung. Silakan hubungkan terlebih dahulu di halaman ini." };
    }

    // 1. Cari pesan dari Gmail API yang relevan dengan transaksi Flip
    // Query: from:flip.id ATAU subject:Flip / Transfer / Pembelian
    const query = encodeURIComponent("from:flip.id OR subject:Flip OR subject:Transfer OR subject:Pembelian");
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error("Gagal mengambil daftar email dari Gmail API:", errText);
      return { error: "Gagal berkomunikasi dengan Gmail API." };
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      return { success: true, processed: 0, newCount: 0, message: "Tidak ada email notifikasi Flip ditemukan di Gmail Anda." };
    }

    let processedCount = 0;
    let newCount = 0;

    // 2. Iterasi setiap pesan, ambil konten full dan urai
    for (const msg of messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!msgRes.ok) continue;

      const msgData = await msgRes.json();
      const payload = msgData.payload;
      if (!payload) continue;

      // Ambik Header Subject
      const headers = payload.headers || [];
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
      const subject = subjectHeader ? subjectHeader.value : "";

      if (!subject) continue;

      // Ambil Body
      const body = extractBodyFromPayload(payload);
      if (!body) continue;

      // 3. Urai isi email menggunakan parseFlipEmail
      const parsed = parseFlipEmail(subject, body);
      if (!parsed || !parsed.flipId) continue;

      processedCount++;

      // 4. Upsert secara AMAN berdasarkan flipId + storeId
      // Hal ini menjamin bahwa email dengan subjek yang sama pada hari yang sama
      // tidak akan terlewat karena setiap transaksi memiliki flipId unik tersendiri.
      const existing = await prisma.flipWebhook.findUnique({
        where: {
          flipId_storeId: {
            flipId: parsed.flipId,
            storeId,
          },
        },
      });

      if (!existing) {
        newCount++;
      }

      await prisma.flipWebhook.upsert({
        where: {
          flipId_storeId: {
            flipId: parsed.flipId,
            storeId,
          },
        },
        update: {
          nominal: parsed.nominal,
          transactionTime: parsed.transactionTime,
          customerName: parsed.customerName,
          customerNumber: parsed.customerNumber,
          bankOrProvider: parsed.bankOrProvider,
          emailSubject: parsed.emailSubject,
        },
        create: {
          storeId,
          flipId: parsed.flipId,
          serviceType: parsed.serviceType,
          nominal: parsed.nominal,
          customerName: parsed.customerName,
          customerNumber: parsed.customerNumber,
          bankOrProvider: parsed.bankOrProvider,
          transactionTime: parsed.transactionTime,
          emailSubject: parsed.emailSubject,
        },
      });
    }

    revalidatePath("/admin/flip-transactions");
    revalidatePath("/admin/store-settings");

    return {
      success: true,
      processed: processedCount,
      newCount,
      message: `Berhasil memproses ${processedCount} email Flip (${newCount} transaksi baru ditambahkan).`,
    };
  } catch (error: any) {
    console.error("Error in syncFlipEmailsFromGmail action:", error);
    return { error: "Terjadi kesalahan sistem saat menarik email dari Gmail." };
  }
}
