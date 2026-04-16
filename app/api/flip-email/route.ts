import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFlipEmail } from "@/lib/flip-parser";

/**
 * POST /api/flip-email
 *
 * Receives email data from Google Apps Script.
 * Headers: x-api-key (must match store.flipApiKey)
 * Body: { subject: string, body: string, storeId: string }
 *
 * Idempotent: if flipId already exists for the store, skips insert.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing x-api-key header" },
        { status: 401 }
      );
    }

    const json = await req.json();
    const { subject, body, storeId } = json as {
      subject?: string;
      body?: string;
      storeId?: string;
    };

    if (!subject || !body || !storeId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: subject, body, storeId" },
        { status: 400 }
      );
    }

    // Validate API key against the store
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { flipApiKey: true },
    });

    if (!store || !store.flipApiKey || store.flipApiKey !== apiKey) {
      return NextResponse.json(
        { success: false, error: "Invalid API key for this store" },
        { status: 403 }
      );
    }

    // Parse email content
    const parsed = parseFlipEmail(subject, body);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Could not parse Flip transaction from email" },
        { status: 422 }
      );
    }

    // Upsert — idempotent by flipId + storeId
    const record = await prisma.flipWebhook.upsert({
      where: {
        flipId_storeId: {
          flipId: parsed.flipId,
          storeId,
        },
      },
      update: {
        // Update fields if re-sent
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

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        flipId: record.flipId,
        serviceType: record.serviceType,
        nominal: record.nominal,
        transactionTime: record.transactionTime,
      },
    });
  } catch (error: any) {
    console.error("flip-email API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
