import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";
import { syncFlipEmailsForStore } from "@/lib/flip-gmail-sync";

function isValidCronAuth(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header || "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * GET /api/cron/sync-flip-gmail
 *
 * Endpoint cron otomatis untuk menarik email Flip secara berkala di latar belakang.
 * Dapat dipanggil oleh Vercel Cron atau Cron-job.org / GitHub Action.
 */
export async function GET(req: NextRequest) {
  try {
    // Wajib: CRON_SECRET harus diset di .env. Tanpa secret, endpoint ini ditolak
    // (fail closed) agar tidak bisa dipicu oleh siapa pun dari internet.
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET belum dikonfigurasi; cron sync-flip-gmail ditolak.");
      return NextResponse.json({ success: false, error: "Cron is not configured" }, { status: 503 });
    }
    if (!isValidCronAuth(authHeader, cronSecret)) {
      return NextResponse.json({ success: false, error: "Unauthorized cron request" }, { status: 401 });
    }

    // Cari semua toko yang memiliki akun Gmail Flip terhubung
    const gmailAuths = await prisma.storeGoogleAuth.findMany({
      where: { type: "GMAIL" },
      select: { storeId: true },
    });

    if (gmailAuths.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada toko dengan integrasi Gmail Flip terhubung.",
      });
    }

    const results = [];

    for (const authItem of gmailAuths) {
      const res = await syncFlipEmailsForStore(authItem.storeId);
      results.push({ storeId: authItem.storeId, result: res });
    }

    return NextResponse.json({
      success: true,
      processedStores: gmailAuths.length,
      results,
    });
  } catch (error: any) {
    console.error("Cron sync-flip-gmail error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
